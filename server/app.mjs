// STATUS: UNVERIFIED (Claude, M11; sandbox tests only, never run on the owner's machine or behind a real proxy).
/**
 * Portfolio API server. Zero dependencies (node:http, node:fs, node:crypto). Implements docs/admin-api-contract.md:
 *   admin (Bearer token): PUT /texts/{key}, PUT /media/{id}, POST /media/upload, PUT|DELETE /collections/{name}/{id},
 *                         PUT /collections/{name}/order, GET /inbox, GET /auth/check
 *   public: POST /reviews, POST /contact (honeypot `website`, rate limited), GET /uploads/{file}, GET /health
 * Content lives in <dataDir>/content.json, the SAME file the Next.js site reads (lib/content/index.ts), so run both from the repo root on one host.
 * Reviews/messages go to <dataDir>/reviews.json and messages.json (moderation = copy into the admin, nothing is auto-published).
 */
import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { COLLECTION_NAMES, validKey, validateLText, validateItem, validateMedia, validateReview, validateContact } from "./validate.mjs";
import { parseMultipart } from "./multipart.mjs";
import { createLimiter } from "./ratelimit.mjs";

class HttpError extends Error { constructor(status, detail, headers) { super(detail); this.status = status; this.detail = detail; this.headers = headers; } }

const UPLOAD_TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", webm: "video/webm" };
const MAGIC = {
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  gif: (b) => b.subarray(0, 4).toString("latin1") === "GIF8",
  webp: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  mp4: (b) => b.subarray(4, 8).toString("latin1") === "ftyp",
  webm: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3,
};
const sha = (s) => crypto.createHash("sha256").update(s).digest();

export function createApp(cfg) {
  const c = {
    token: "", dataDir: "", seedFile: "", allowedOrigins: [], publicUrl: null, maxUploadBytes: 100 * 1024 * 1024,
    trustProxy: false, now: () => Date.now(), log: () => {}, ...cfg,
    limits: { form: { windowMs: 3600_000, max: 5 }, formGlobal: { windowMs: 3600_000, max: 200 }, authFail: { windowMs: 900_000, max: 10 }, admin: { windowMs: 60_000, max: 300 }, ...(cfg.limits || {}) },
  };
  if (typeof c.token !== "string" || c.token.length < 16) throw new Error("ADMIN_TOKEN must be set and at least 16 characters");
  if (!c.dataDir || !c.seedFile) throw new Error("dataDir and seedFile are required");
  const tokenHash = sha(c.token);
  const contentFile = path.join(c.dataDir, "content.json");
  const uploadDir = path.join(c.dataDir, "uploads");
  const reviewsFile = path.join(c.dataDir, "reviews.json");
  const messagesFile = path.join(c.dataDir, "messages.json");
  const lim = {
    form: createLimiter({ ...c.limits.form, now: c.now }), formGlobal: createLimiter({ ...c.limits.formGlobal, now: c.now }),
    authFail: createLimiter({ ...c.limits.authFail, now: c.now }), admin: createLimiter({ ...c.limits.admin, now: c.now }),
  };

  // ---------- storage ----------
  let chain = Promise.resolve();
  const withLock = (fn) => { const p = chain.then(fn); chain = p.catch(() => {}); return p; };
  let seedCache = null;
  async function readSeed() { return (seedCache ??= JSON.parse(await fs.readFile(c.seedFile, "utf8"))); }
  async function writeJsonAtomic(file, data) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
    try { await fs.copyFile(file, file + ".bak"); } catch { /* first write */ }
    for (let i = 0; ; i++) { // Windows may refuse rename while the site is reading the file
      try { await fs.rename(tmp, file); return; }
      catch (e) { if (i >= 8 || !["EPERM", "EBUSY", "EACCES"].includes(e.code)) { await fs.rm(tmp, { force: true }); throw e; } await new Promise((r) => setTimeout(r, 25)); }
    }
  }
  async function loadContent() {
    let d;
    try { d = JSON.parse(await fs.readFile(contentFile, "utf8")); }
    catch (e) { if (e.code === "ENOENT") return structuredClone(await readSeed()); throw new Error("content file unreadable: " + e.message); }
    if (!d || typeof d !== "object" || !d.texts || !d.media || !d.collections) throw new Error("content file has an unexpected shape");
    return d;
  }
  /** fn(d) mutates `d` and returns undefined, or throws HttpError to abort without writing. */
  const mutate = (fn) => withLock(async () => { const d = await loadContent(); const r = fn(d); await writeJsonAtomic(contentFile, d); return r; });
  const readList = async (file) => { try { const a = JSON.parse(await fs.readFile(file, "utf8")); return Array.isArray(a) ? a : []; } catch { return []; } };
  const appendList = (file, entry) => withLock(async () => {
    const a = await readList(file); a.push(entry); await writeJsonAtomic(file, a.length > 2000 ? a.slice(-2000) : a);
  });

  const ready = (async () => {
    await fs.mkdir(uploadDir, { recursive: true });
    try { await fs.access(contentFile); } catch { await writeJsonAtomic(contentFile, await readSeed()); } // the site and the server share this file
  })();

  // ---------- http helpers ----------
  const ipOf = (req) => (c.trustProxy && String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || req.socket.remoteAddress || "?";
  function send(res, status, body, extra = {}) {
    const b = body === undefined ? "" : JSON.stringify(body);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(b), ...extra });
    res.end(b);
  }
  async function readBody(req, limit) {
    const declared = Number(req.headers["content-length"]);
    if (Number.isFinite(declared) && declared > limit) throw new HttpError(413, "payload too large");
    const chunks = []; let n = 0;
    for await (const ch of req) { n += ch.length; if (n > limit) throw new HttpError(413, "payload too large"); chunks.push(ch); }
    return Buffer.concat(chunks);
  }
  async function readJson(req) {
    if (!/^application\/json\b/i.test(req.headers["content-type"] || "")) throw new HttpError(415, "Content-Type must be application/json");
    const buf = await readBody(req, 64 * 1024);
    try { return JSON.parse(buf.toString("utf8")); } catch { throw new HttpError(400, "invalid JSON"); }
  }
  function requireAdmin(req) {
    const ip = ipOf(req);
    if (lim.authFail.blocked(ip)) throw new HttpError(429, "too many failed attempts", { "Retry-After": "900" });
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
    const ok = !!m && crypto.timingSafeEqual(sha(m[1]), tokenHash);
    if (!ok) { lim.authFail.hit(ip); throw new HttpError(401, "unauthorized", { "WWW-Authenticate": "Bearer" }); }
    const r = lim.admin.hit(ip);
    if (!r.ok) throw new HttpError(429, "too many requests", { "Retry-After": String(r.retryAfter) });
  }
  function publicLimit(kind, req) {
    const ip = ipOf(req);
    const a = lim.form.hit(`${kind}:${ip}`), b = lim.formGlobal.hit(kind);
    if (!a.ok || !b.ok) { const s = Math.max(a.retryAfter, b.retryAfter); throw new HttpError(429, "Too many requests, please try again later", { "Retry-After": String(s) }); }
  }
  const decode = (s) => { try { return decodeURIComponent(s); } catch { throw new HttpError(400, "bad url encoding"); } };

  // ---------- routes ----------
  async function route(req, res, url) {
    const segs = url.pathname.split("/").filter(Boolean).map(decode);
    const m = req.method;
    const [a, b, d] = segs;

    if (a === "health" && segs.length === 1 && m === "GET") return send(res, 200, { ok: true });
    if (a === "auth" && b === "check" && segs.length === 2 && m === "GET") { requireAdmin(req); return send(res, 200, { ok: true }); }

    if (a === "uploads" && segs.length === 2 && (m === "GET" || m === "HEAD")) return serveUpload(req, res, b);

    if (a === "reviews" && segs.length === 1 && m === "POST") {
      publicLimit("reviews", req);
      const v = validateReview(await readJson(req));
      if (v.error) throw new HttpError(422, v.error);
      await appendList(reviewsFile, { id: crypto.randomUUID(), at: new Date(c.now()).toISOString(), ...v.value });
      return send(res, 201, { ok: true });
    }
    if (a === "contact" && segs.length === 1 && m === "POST") {
      publicLimit("contact", req);
      const v = validateContact(await readJson(req));
      if (v.error) throw new HttpError(422, v.error);
      await appendList(messagesFile, { id: crypto.randomUUID(), at: new Date(c.now()).toISOString(), ...v.value });
      return send(res, 201, { ok: true });
    }

    if (a === "inbox" && segs.length === 1 && m === "GET") {
      requireAdmin(req);
      return send(res, 200, { reviews: await readList(reviewsFile), messages: await readList(messagesFile) });
    }

    if (a === "texts" && segs.length === 2 && m === "PUT") {
      requireAdmin(req);
      if (!validKey(b)) throw new HttpError(422, "invalid text key");
      const body = await readJson(req);
      const e = validateLText(body);
      if (e) throw new HttpError(422, e);
      await mutate((data) => {
        if (!(b in data.texts) && Object.keys(data.texts).length >= 2000) throw new HttpError(422, "too many texts");
        data.texts[b] = body.en === undefined ? { ar: body.ar } : { ar: body.ar, en: body.en };
      });
      return send(res, 200, { ok: true });
    }

    if (a === "media" && b === "upload" && segs.length === 2 && m === "POST") { requireAdmin(req); return upload(req, res); }
    if (a === "media" && segs.length === 2 && m === "PUT") {
      requireAdmin(req);
      const body = await readJson(req);
      const e = validateMedia(body, b);
      if (e) throw new HttpError(422, e);
      await mutate((data) => {
        if (!(b in data.media) && Object.keys(data.media).length >= 500) throw new HttpError(422, "too many media slots");
        data.media[b] = { id: b, url: body.url, type: body.type, ...(body.alt !== undefined ? { alt: body.alt } : {}) };
      });
      return send(res, 200, { ok: true });
    }

    if (a === "collections" && b !== undefined) {
      if (!COLLECTION_NAMES.includes(b)) throw new HttpError(404, "unknown collection");
      if (segs.length === 3 && d === "order" && m === "PUT") {
        requireAdmin(req);
        const body = await readJson(req);
        const ids = body && body.ids;
        if (!Array.isArray(ids) || ids.length > 500 || ids.some((x) => typeof x !== "string") || new Set(ids).size !== ids.length) throw new HttpError(422, "ids must be a list of unique strings");
        await mutate((data) => {
          const arr = data.collections[b] || [];
          if (arr.length !== ids.length || !arr.every((it) => ids.includes(it.id))) throw new HttpError(422, "ids must be exactly the ids of the collection");
          data.collections[b] = ids.map((id) => arr.find((it) => it.id === id));
        });
        return send(res, 200, { ok: true });
      }
      if (segs.length === 3 && m === "PUT") {
        requireAdmin(req);
        const item = await readJson(req);
        const e = validateItem(b, item, d);
        if (e) throw new HttpError(422, e);
        await mutate((data) => {
          const arr = (data.collections[b] ||= []);
          const i = arr.findIndex((it) => it.id === d);
          if (i >= 0) arr[i] = item; else { if (arr.length >= 500) throw new HttpError(422, "collection is full (500)"); arr.push(item); }
        });
        return send(res, 200, { ok: true });
      }
      if (segs.length === 3 && m === "DELETE") {
        requireAdmin(req);
        const deleted = await mutate((data) => {
          const arr = data.collections[b] || [];
          const i = arr.findIndex((it) => it.id === d);
          if (i >= 0) arr.splice(i, 1);
          return i >= 0;
        });
        return send(res, 200, { ok: true, deleted });
      }
    }
    // known path shape with a wrong method -> 405
    if (["health", "auth", "uploads", "reviews", "contact", "inbox", "texts", "media", "collections"].includes(a)) throw new HttpError(405, "method not allowed");
    throw new HttpError(404, "not found");
  }

  async function upload(req, res) {
    if (!/^multipart\/form-data\b/i.test(req.headers["content-type"] || "")) throw new HttpError(415, "Content-Type must be multipart/form-data");
    const buf = await readBody(req, c.maxUploadBytes + 64 * 1024);
    const parts = parseMultipart(buf, req.headers["content-type"]);
    const file = parts && parts.find((p) => p.name === "file" && p.filename !== null);
    if (!file) throw new HttpError(422, 'multipart field "file" is required');
    const ext = (/\.([A-Za-z0-9]+)$/.exec(file.filename) || [])[1]?.toLowerCase();
    if (!ext || !(ext in UPLOAD_TYPES)) throw new HttpError(422, "file type not allowed (jpg, png, webp, gif, mp4, webm)");
    if (file.data.length === 0) throw new HttpError(422, "empty file");
    if (file.data.length > c.maxUploadBytes) throw new HttpError(413, "file too large");
    if (!MAGIC[ext](file.data)) throw new HttpError(422, "file content does not match its extension");
    const name = `${c.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, name), file.data, { flag: "wx" });
    const origin = c.publicUrl || `${c.trustProxy && req.headers["x-forwarded-proto"] === "https" ? "https" : "http"}://${req.headers.host}`;
    return send(res, 201, { url: `${origin.replace(/\/$/, "")}/uploads/${name}`, type: UPLOAD_TYPES[ext].startsWith("video") ? "video" : "image", size: file.data.length });
  }

  async function serveUpload(req, res, name) {
    const mm = /^[a-z0-9-]+\.(jpg|jpeg|png|webp|gif|mp4|webm)$/.exec(name);
    if (!mm) throw new HttpError(404, "not found");
    const file = path.join(uploadDir, name);
    let st;
    try { st = await fs.stat(file); } catch { throw new HttpError(404, "not found"); }
    const headers = { "Content-Type": UPLOAD_TYPES[mm[1]], "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=31536000, immutable", "Cross-Origin-Resource-Policy": "cross-origin" };
    let start = 0, end = st.size - 1, status = 200;
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (range && (range[1] || range[2])) {
      if (range[1] === "") { start = Math.max(0, st.size - Number(range[2])); } else { start = Number(range[1]); if (range[2]) end = Math.min(end, Number(range[2])); }
      if (start > end || start >= st.size) { res.writeHead(416, { "Content-Range": `bytes */${st.size}` }); return res.end(); }
      status = 206; headers["Content-Range"] = `bytes ${start}-${end}/${st.size}`;
    }
    headers["Content-Length"] = end - start + 1;
    res.writeHead(status, headers);
    if (req.method === "HEAD") return res.end();
    await new Promise((resolve) => { const s = createReadStream(file, { start, end }); s.on("error", () => { res.destroy(); resolve(); }); s.on("close", resolve); s.pipe(res); });
  }

  // ---------- entry ----------
  async function handler(req, res) {
    const t0 = c.now();
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    const origin = req.headers.origin;
    const allowed = origin && c.allowedOrigins.includes(origin);
    if (allowed) { res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary", "Origin"); }
    try {
      await ready;
      if (req.method === "OPTIONS") {
        if (origin && !allowed) throw new HttpError(403, "origin not allowed");
        res.writeHead(204, { "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "600" });
        return res.end();
      }
      await route(req, res, new URL(req.url, "http://x"));
    } catch (e) {
      if (res.headersSent) { res.destroy(); return; }
      if (e instanceof HttpError) send(res, e.status, { detail: e.detail }, e.headers);
      else { c.log("error", req.method, req.url, e); send(res, 500, { detail: "server error" }); }
    } finally {
      c.log("req", req.method, new URL(req.url, "http://x").pathname, res.statusCode, `${c.now() - t0}ms`);
    }
  }
  return { handler, ready };
}
