// STATUS: UNVERIFIED (Claude, M11; run in the cloud sandbox only, not yet on the owner's machine)
/** Server (server/*.mjs) over real HTTP on an ephemeral port, temp data dir. Covers auth, validation, CRUD, order, upload+Range, forms, CORS, rate limits, parity with the browser validators. */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { createApp } from "../server/app.mjs";
import * as sv from "../server/validate.mjs";
import { parseMultipart } from "../server/multipart.mjs";
import { createLimiter } from "../server/ratelimit.mjs";
import * as cv from "../lib/admin/validate";
import { validateContact as browserContact } from "../lib/contact";
import { validateReview as browserReview } from "../lib/review";
import seed from "../content/seed.json";

const TOKEN = "test-token-0123456789";
const SEED = path.join(process.cwd(), "content", "seed.json");
const dirs: string[] = [];
let dir = "", mainDir = "", base = "", server: http.Server, clock = 1_700_000_000_000;

async function boot(over: Record<string, unknown> = {}) {
  dir = mkdtempSync(path.join(os.tmpdir(), "srv-"));
  dirs.push(dir);
  const app = createApp({ token: TOKEN, dataDir: dir, seedFile: SEED, allowedOrigins: ["http://localhost:3000"], now: () => clock, ...over } as never);
  const s = http.createServer(app.handler as never);
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  await app.ready;
  return { s, url: `http://127.0.0.1:${(s.address() as { port: number }).port}` };
}
before(async () => { const b = await boot({ limits: { authFail: { windowMs: 900000, max: 100000 }, admin: { windowMs: 60000, max: 100000 } } }); server = b.s; base = b.url; mainDir = dir; });
after(() => { server.close(); for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const auth = { Authorization: `Bearer ${TOKEN}` };
const J = { "Content-Type": "application/json" };
const call = (m: string, p: string, body?: unknown, h: Record<string, string> = auth) =>
  fetch(base + p, { method: m, headers: { ...(body !== undefined ? J : {}), ...h }, body: body === undefined ? undefined : JSON.stringify(body) });
const content = () => JSON.parse(readFileSync(path.join(mainDir, "content.json"), "utf8")); // main server (other tests boot their own and move `dir`)

// ---------- startup ----------
test("refuses to start without a strong token / data paths", () => {
  assert.throws(() => createApp({ token: "short", dataDir: "x", seedFile: "y" } as never), /ADMIN_TOKEN/);
  assert.throws(() => createApp({ token: TOKEN, dataDir: "", seedFile: "" } as never), /required/);
});
test("first start copies the seed to data/content.json (the file the site reads)", () => {
  assert.deepEqual(content(), seed);
  assert.ok(existsSync(path.join(mainDir, "uploads")));
});
test("GET /health is public", async () => { const r = await call("GET", "/health", undefined, {}); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true }); });

// ---------- auth ----------
test("every admin route rejects a missing or wrong token with 401", async () => {
  const routes: Array<[string, string, unknown?]> = [
    ["PUT", "/texts/hero.title", { ar: "x" }], ["PUT", "/media/brand.logo", { id: "brand.logo", url: "/a.png", type: "image" }],
    ["PUT", "/collections/skills/x1", { id: "x1" }], ["DELETE", "/collections/skills/premiere"], ["PUT", "/collections/skills/order", { ids: [] }],
    ["GET", "/inbox"], ["GET", "/auth/check"],
  ];
  for (const [m, p, b] of routes) {
    assert.equal((await call(m, p, b, {})).status, 401, `${m} ${p} without token`);
    assert.equal((await call(m, p, b, { Authorization: "Bearer wrong-wrong-wrong-wrong" })).status, 401, `${m} ${p} wrong token`);
    assert.equal((await call(m, p, b, { Authorization: TOKEN })).status, 401, `${m} ${p} not Bearer`);
  }
  const up = await fetch(base + "/media/upload", { method: "POST" });
  assert.equal(up.status, 401);
  assert.equal(JSON.stringify(content()).includes("wrong-wrong"), false);
});
test("GET /auth/check accepts the right token", async () => assert.equal((await call("GET", "/auth/check")).status, 200));

// ---------- texts ----------
test("PUT /texts/{key}: create/replace, en optional, stored in the shared file", async () => {
  assert.equal((await call("PUT", "/texts/hero.title", { ar: "عنوان جديد", en: "New title" })).status, 200);
  assert.deepEqual(content().texts["hero.title"], { ar: "عنوان جديد", en: "New title" });
  assert.equal((await call("PUT", "/texts/hero.title", { ar: "فقط عربي" })).status, 200);
  assert.deepEqual(content().texts["hero.title"], { ar: "فقط عربي" });
  assert.equal((await call("PUT", "/texts/brand.newKey", { ar: "a" })).status, 200);
});
test("PUT /texts: invalid key / body → 422, nothing written", async () => {
  const before = JSON.stringify(content());
  for (const [k, b] of [["Bad Key", { ar: "x" }], ["1abc", { ar: "x" }], ["a..b", { ar: "x" }], ["hero.title", { en: "x" }], ["hero.title", { ar: 5 }], ["hero.title", { ar: "x", extra: 1 }], ["hero.title", { ar: "x".repeat(5001) }], ["hero.title", [1]]] as const)
    assert.equal((await call("PUT", `/texts/${encodeURIComponent(k)}`, b)).status, 422, `${k} ${JSON.stringify(b).slice(0, 30)}`);
  assert.equal(JSON.stringify(content()), before);
});
test("bad JSON → 400, wrong content type → 415, oversize → 413", async () => {
  assert.equal((await fetch(base + "/texts/hero.title", { method: "PUT", headers: { ...auth, ...J }, body: "{nope" })).status, 400);
  assert.equal((await fetch(base + "/texts/hero.title", { method: "PUT", headers: { ...auth, "Content-Type": "text/plain" }, body: "{}" })).status, 415);
  assert.equal((await fetch(base + "/texts/hero.title", { method: "PUT", headers: { ...auth, ...J }, body: JSON.stringify({ ar: "x".repeat(70000) }) })).status, 413);
});

// ---------- media ----------
test("PUT /media/{id}: valid slot stored; javascript:/data:/protocol-relative/mailto refused", async () => {
  assert.equal((await call("PUT", "/media/about.photo", { id: "about.photo", url: "https://cdn.example.com/a.webp", type: "image", alt: "me" })).status, 200);
  assert.deepEqual(content().media["about.photo"], { id: "about.photo", url: "https://cdn.example.com/a.webp", type: "image", alt: "me" });
  for (const url of ["javascript:alert(1)", " JaVa\nScRiPt:alert(1)", "data:text/html,<script>", "//evil.com/x.png", "mailto:a@b.co", "file:///etc/passwd", "vbscript:x", "", "#x"])
    assert.equal((await call("PUT", "/media/about.photo", { id: "about.photo", url, type: "image" })).status, 422, url);
  assert.equal((await call("PUT", "/media/about.photo", { id: "other", url: "/a.png", type: "image" })).status, 422);
  assert.equal((await call("PUT", "/media/about.photo", { id: "about.photo", url: "/a.png", type: "audio" })).status, 422);
  assert.equal((await call("PUT", "/media/about.photo", { id: "about.photo", url: "/a.png", type: "image", evil: 1 })).status, 422);
});

// ---------- collections ----------
test("every seed item of every collection passes server validation (the server accepts what the site already has)", () => {
  for (const name of sv.COLLECTION_NAMES) for (const it of (seed.collections as Record<string, Array<{ id: string }>>)[name]) assert.equal(sv.validateItem(name, it, it.id), null, `${name}/${it.id}`);
});
test("PUT item: create appends, same id replaces in place; DELETE removes (idempotent); order reorders", async () => {
  const sk = { id: "davinci", name: "DaVinci Resolve", percent: 60, badge: "Dv" };
  assert.equal((await call("PUT", "/collections/skills/davinci", sk)).status, 200);
  const ids = () => content().collections.skills.map((x: { id: string }) => x.id);
  assert.equal(ids().at(-1), "davinci");
  assert.equal((await call("PUT", "/collections/skills/davinci", { ...sk, percent: 70 })).status, 200);
  assert.equal(content().collections.skills.find((x: { id: string }) => x.id === "davinci").percent, 70);
  assert.equal(ids().filter((x: string) => x === "davinci").length, 1);
  const reordered = [...ids()].reverse();
  assert.equal((await call("PUT", "/collections/skills/order", { ids: reordered })).status, 200);
  assert.deepEqual(ids(), reordered);
  assert.deepEqual(await (await call("DELETE", "/collections/skills/davinci")).json(), { ok: true, deleted: true });
  assert.deepEqual(await (await call("DELETE", "/collections/skills/davinci")).json(), { ok: true, deleted: false });
  assert.ok(!ids().includes("davinci"));
});
test("PUT order must be exactly the current ids (no loss, no extras, no duplicates)", async () => {
  const cur = content().collections.skills.map((x: { id: string }) => x.id) as string[];
  for (const bad of [cur.slice(1), [...cur, "ghost"], [cur[0], cur[0], ...cur.slice(2)], "nope", [1, 2]])
    assert.equal((await call("PUT", "/collections/skills/order", { ids: bad })).status, 422, JSON.stringify(bad).slice(0, 40));
  assert.deepEqual(content().collections.skills.map((x: { id: string }) => x.id), cur);
});
test("PUT item validation: id mismatch, reserved id, unknown field, unknown collection, bad urls, bad types", async () => {
  const w = { id: "w9", category: "social", order: 9, title: { ar: "9" }, desc: { ar: "" }, tag: null, video: "/assets/v.mp4", poster: null };
  assert.equal((await call("PUT", "/collections/works/w9", w)).status, 200);
  assert.equal((await call("PUT", "/collections/works/w8", w)).status, 422, "id mismatch");
  assert.equal((await call("PUT", "/collections/works/order", { ...w, id: "order" })).status, 422, "order is the reorder endpoint");
  assert.equal((await call("PUT", "/collections/skills/order", { id: "order", name: "x", percent: 1 })).status, 422);
  assert.equal((await call("PUT", "/collections/works/w9", { ...w, extra: 1 })).status, 422);
  assert.equal((await call("PUT", "/collections/nothing/x", { id: "x" })).status, 404);
  assert.equal((await call("PUT", "/collections/works/w9", { ...w, video: "javascript:alert(1)" })).status, 422);
  assert.equal((await call("PUT", "/collections/works/w9", { ...w, poster: "data:image/png;base64,AA" })).status, 422);
  assert.equal((await call("PUT", "/collections/works/w9", { ...w, order: -1 })).status, 422);
  assert.equal((await call("PUT", "/collections/works/w9", { ...w, title: "plain string" })).status, 422);
  assert.equal((await call("PUT", "/collections/works/w9", { ...w, tag: undefined })).status, 422, "tag is required (null allowed)");
  assert.equal((await call("PUT", "/collections/skills/s1", { id: "s1", name: "x", percent: 101 })).status, 422);
  assert.equal((await call("PUT", "/collections/skills/bad id", { id: "bad id", name: "x", percent: 1 })).status, 422);
  assert.equal((await call("DELETE", "/collections/works/w9")).status, 200);
});
test("contact.links: id must be one of the four; email/whatsapp/handles validated", async () => {
  const put = (id: string, value: string) => call("PUT", `/collections/contact.links/${id}`, { id, value });
  assert.equal((await put("email", "a@b.co")).status, 200);
  assert.equal((await put("email", "not-an-email")).status, 422);
  assert.equal((await put("whatsapp", "+963 944 000 111")).status, 200);
  assert.equal((await put("whatsapp", "abc")).status, 422);
  assert.equal((await put("instagram", "javascript:alert(1)")).status, 422);
  assert.equal((await put("instagram", "https://instagram.com/x")).status, 200);
  assert.equal((await put("tiktok", "x")).status, 422);
});

// ---------- upload + serve ----------
function multipart(parts: Array<{ name: string; filename?: string; type?: string; data: Buffer | string }>) {
  const b = "----t" + Math.random().toString(16).slice(2);
  const chunks: Buffer[] = [];
  for (const p of parts) {
    chunks.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${p.name}"${p.filename !== undefined ? `; filename="${p.filename}"` : ""}\r\n${p.type ? `Content-Type: ${p.type}\r\n` : ""}\r\n`), Buffer.isBuffer(p.data) ? p.data : Buffer.from(p.data), Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${b}--\r\n`));
  return { body: Buffer.concat(chunks), ct: `multipart/form-data; boundary=${b}` };
}
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("0123456789abcdef".repeat(8))]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(2000, 7)]);
const up = async (parts: Parameters<typeof multipart>[0], h: Record<string, string> = auth) => { const m = multipart(parts); return fetch(base + "/media/upload", { method: "POST", headers: { ...h, "Content-Type": m.ct }, body: new Uint8Array(m.body) }); };

test("upload: png and mp4 accepted, stored under random names, served with the right type; Range gives 206", async () => {
  const r = await up([{ name: "file", filename: "photo.PNG", type: "image/png", data: PNG }]);
  assert.equal(r.status, 201);
  const j = (await r.json()) as { url: string; type: string };
  assert.match(j.url, /^http:\/\/127\.0\.0\.1:\d+\/uploads\/[a-z0-9]+-[0-9a-f]{12}\.png$/);
  assert.equal(j.type, "image");
  const got = await fetch(j.url);
  assert.equal(got.headers.get("content-type"), "image/png");
  assert.equal(got.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await got.arrayBuffer()), PNG);

  const v = (await (await up([{ name: "file", filename: "clip.mp4", data: MP4 }])).json()) as { url: string; type: string };
  assert.equal(v.type, "video");
  const part = await fetch(v.url, { headers: { Range: "bytes=10-19" } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get("content-range"), `bytes 10-19/${MP4.length}`);
  assert.deepEqual(Buffer.from(await part.arrayBuffer()), MP4.subarray(10, 20));
  assert.equal((await fetch(v.url, { headers: { Range: "bytes=-5" } })).status, 206);
  assert.equal((await fetch(v.url, { headers: { Range: `bytes=${MP4.length + 5}-` } })).status, 416);
  assert.equal((await fetch(v.url, { method: "HEAD" })).headers.get("content-length"), String(MP4.length));
});
test("upload refusals: no auth, wrong extension, wrong magic bytes, svg/html, empty, no file field, not multipart", async () => {
  assert.equal((await up([{ name: "file", filename: "a.png", data: PNG }], {})).status, 401);
  assert.equal((await up([{ name: "file", filename: "a.exe", data: PNG }])).status, 422);
  assert.equal((await up([{ name: "file", filename: "a.svg", data: "<svg onload=alert(1)>" }])).status, 422);
  assert.equal((await up([{ name: "file", filename: "a.html", data: "<script>" }])).status, 422);
  assert.equal((await up([{ name: "file", filename: "a.png", data: "<script>alert(1)</script>" }])).status, 422, "magic bytes");
  assert.equal((await up([{ name: "file", filename: "a.png", data: Buffer.alloc(0) }])).status, 422);
  assert.equal((await up([{ name: "other", filename: "a.png", data: PNG }])).status, 422);
  assert.equal((await up([{ name: "file", data: "no filename" }])).status, 422);
  assert.equal((await fetch(base + "/media/upload", { method: "POST", headers: { ...auth, ...J }, body: "{}" })).status, 415);
  assert.equal((await fetch(base + "/media/upload", { method: "POST", headers: { ...auth, "Content-Type": "multipart/form-data; boundary=zzz" }, body: "garbage" })).status, 422);
});
test("upload: size limit → 413 and nothing stored", async () => {
  const b = await boot({ maxUploadBytes: 1000 });
  try {
    const m = multipart([{ name: "file", filename: "big.png", data: Buffer.concat([PNG, Buffer.alloc(5000)]) }]);
    const r = await fetch(b.url + "/media/upload", { method: "POST", headers: { ...auth, "Content-Type": m.ct }, body: new Uint8Array(m.body) });
    assert.equal(r.status, 413);
    assert.deepEqual(readdirSync(path.join(dir, "uploads")), []);
  } finally { b.s.close(); }
});
test("/uploads: path traversal and unknown names are 404", async () => {
  for (const p of ["/uploads/..%2Fcontent.json", "/uploads/%2e%2e%2fcontent.json", "/uploads/nope.png", "/uploads/a.txt", "/uploads/x.png/../../content.json"])
    assert.equal((await fetch(base + p)).status, 404, p);
});

// ---------- public forms ----------
const review = { name: "ليلى", role: "مديرة", text: "تجربة ممتازة وشغل مرتب جداً", website: "" };
test("POST /reviews: 201 and stored (not published); honeypot, short fields, wrong type → 422", async () => {
  const b = await boot({ limits: { form: { windowMs: 3600000, max: 1000 } } });
  try {
    const post = (body: unknown, h: Record<string, string> = J) => fetch(b.url + "/reviews", { method: "POST", headers: h, body: JSON.stringify(body) });
    assert.equal((await post(review)).status, 201);
    const stored = JSON.parse(readFileSync(path.join(dir, "reviews.json"), "utf8"));
    assert.equal(stored.length, 1);
    assert.equal(stored[0].name, "ليلى");
    assert.equal("website" in stored[0], false);
    assert.equal(JSON.parse(readFileSync(path.join(dir, "content.json"), "utf8")).collections.testimonials.length, seed.collections.testimonials.length, "never auto-published");
    assert.equal((await post({ ...review, website: "http://spam" })).status, 422);
    assert.equal((await post({ ...review, name: "a" })).status, 422);
    assert.equal((await post({ ...review, text: "short" })).status, 422);
    assert.equal((await post({ ...review, text: "x".repeat(501) })).status, 422);
    assert.equal((await post({ ...review, role: "r".repeat(81) })).status, 422);
    assert.equal((await post(review, { "Content-Type": "text/plain" })).status, 415);
    assert.equal((await fetch(b.url + "/reviews", { method: "POST", headers: J, body: "[" })).status, 400);
  } finally { b.s.close(); }
});
test("POST /contact: 201 and stored; validation 422", async () => {
  const b = await boot({ limits: { form: { windowMs: 3600000, max: 1000 } } });
  try {
    const post = (body: unknown) => fetch(b.url + "/contact", { method: "POST", headers: J, body: JSON.stringify(body) });
    const ok = { name: "سامر", email: "s@example.com", msg: "أريد مونتاج لإعلان قصير", website: "" };
    assert.equal((await post(ok)).status, 201);
    assert.equal(JSON.parse(readFileSync(path.join(dir, "messages.json"), "utf8"))[0].email, "s@example.com");
    for (const bad of [{ ...ok, email: "nope" }, { ...ok, name: "s" }, { ...ok, msg: "short" }, { ...ok, website: "x" }, null, "str"]) assert.equal((await post(bad)).status, 422, JSON.stringify(bad));
  } finally { b.s.close(); }
});
test("forms are rate limited per client (429 with a string `detail` and Retry-After) and the window resets", async () => {
  const b = await boot({ limits: { form: { windowMs: 1000, max: 2 } } });
  try {
    const post = () => fetch(b.url + "/reviews", { method: "POST", headers: J, body: JSON.stringify(review) });
    assert.equal((await post()).status, 201);
    assert.equal((await post()).status, 201);
    const r = await post();
    assert.equal(r.status, 429);
    assert.equal(typeof ((await r.json()) as { detail: unknown }).detail, "string");
    assert.ok(Number(r.headers.get("retry-after")) >= 1);
    clock += 2000;
    assert.equal((await post()).status, 201);
  } finally { b.s.close(); }
});
test("repeated wrong tokens are throttled (429) even for the right token afterwards", async () => {
  const b = await boot({ limits: { authFail: { windowMs: 60000, max: 3 } } });
  try {
    const bad = () => fetch(b.url + "/auth/check", { headers: { Authorization: "Bearer wrong-wrong-wrong-wrong" } });
    for (let i = 0; i < 3; i++) assert.equal((await bad()).status, 401);
    assert.equal((await bad()).status, 429);
    assert.equal((await fetch(b.url + "/auth/check", { headers: auth })).status, 429);
  } finally { b.s.close(); }
});
test("GET /inbox returns reviews and messages for the admin", async () => {
  const b = await boot();
  try {
    await fetch(b.url + "/reviews", { method: "POST", headers: J, body: JSON.stringify(review) });
    const r = await fetch(b.url + "/inbox", { headers: auth });
    const j = (await r.json()) as { reviews: unknown[]; messages: unknown[] };
    assert.equal(j.reviews.length, 1);
    assert.deepEqual(j.messages, []);
  } finally { b.s.close(); }
});

// ---------- CORS / misc ----------
test("CORS: allowed origin is reflected, others are not; preflight 204 / 403", async () => {
  const ok = await fetch(base + "/health", { headers: { Origin: "http://localhost:3000" } });
  assert.equal(ok.headers.get("access-control-allow-origin"), "http://localhost:3000");
  const no = await fetch(base + "/health", { headers: { Origin: "http://evil.example" } });
  assert.equal(no.headers.get("access-control-allow-origin"), null);
  const pre = await fetch(base + "/texts/hero.title", { method: "OPTIONS", headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "PUT" } });
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get("access-control-allow-headers") || "", /Authorization/);
  const bad = await fetch(base + "/texts/hero.title", { method: "OPTIONS", headers: { Origin: "http://evil.example" } });
  assert.equal(bad.status, 403);
});
test("unknown paths 404, wrong methods 405, malformed escapes 400, errors never leak internals", async () => {
  assert.equal((await call("GET", "/nope", undefined, {})).status, 404);
  assert.equal((await call("GET", "/texts/hero.title", undefined, {})).status, 405);
  assert.equal((await call("POST", "/health", undefined, {})).status, 405);
  assert.equal((await call("GET", "/texts/%E0%A4%A", undefined, {})).status, 400, "malformed percent-escape");
});
test("a corrupt content file is never overwritten: the write fails with 500 and the file is untouched", async () => {
  const b = await boot();
  try {
    writeFileSync(path.join(dir, "content.json"), "{ broken");
    const r = await fetch(b.url + "/texts/hero.title", { method: "PUT", headers: { ...auth, ...J }, body: JSON.stringify({ ar: "x" }) });
    assert.equal(r.status, 500);
    assert.deepEqual(await r.json(), { detail: "server error" });
    assert.equal(readFileSync(path.join(dir, "content.json"), "utf8"), "{ broken");
  } finally { b.s.close(); }
});
test("concurrent writes do not lose updates (serialised)", async () => {
  const b = await boot();
  try {
    await Promise.all(Array.from({ length: 25 }, (_, i) => fetch(b.url + `/texts/test.k${i}`, { method: "PUT", headers: { ...auth, ...J }, body: JSON.stringify({ ar: String(i) }) }).then((r) => assert.equal(r.status, 200))));
    const t = JSON.parse(readFileSync(path.join(dir, "content.json"), "utf8")).texts;
    for (let i = 0; i < 25; i++) assert.equal(t[`test.k${i}`].ar, String(i));
  } finally { b.s.close(); }
});

// ---------- unit: parity with the browser validators, multipart, limiter ----------
test("parity: server safeUrl/validKey/validId/validateLText agree with lib/admin/validate on a hostile corpus", () => {
  const urls = ["http://a.b", "https://a.b/x?y=1", "/x", "//x", "/\\x", "assets/x.mp4", "#top", "mailto:a@b.c", "tel:+1", "javascript:alert(1)", " JAVASCRIPT:x", "java\tscript:x", "java\nscript:x", "data:text/html,x", "vbscript:x", "file:///x", "ftp://x", "x.png", "", "   ", "\u0000javascript:x", "HTTPS://A.B", "blob:http://x"];
  for (const u of urls) assert.equal(sv.safeUrl(u), cv.safeUrl(u), `safeUrl ${JSON.stringify(u)}`);
  for (const k of ["hero.title", "works.items[0]", "Hero", "a..b", "a b", "", "a1.b2", "x[1][2]", "a."]) assert.equal(sv.validKey(k), cv.validKey(k), `validKey ${k}`);
  for (const id of ["p1", "a_b-c", "-x", "", "a".repeat(64), "a".repeat(65), "a b", "ü"]) assert.equal(sv.validId(id), cv.validId(id), `validId ${id}`);
  for (const v of [{ ar: "x" }, { ar: "x", en: "y" }, { ar: 1 }, { en: "x" }, null, "s", { ar: "x".repeat(5001) }, { ar: "x", en: 3 }]) assert.equal(sv.validateLText(v) === null, cv.validateLText(v) === null, JSON.stringify(v));
});
test("parity: server review/contact rules agree with lib/review and lib/contact", () => {
  for (const [name, text] of [["ab", "0123456789"], ["a", "0123456789"], ["ab", "012345678"], ["", ""]] as const)
    assert.equal("value" in sv.validateReview({ name, role: "", text, website: "" }), browserReview({ name, role: "", text, website: "" }) === null);
  for (const [name, email, msg] of [["ab", "a@b.co", "0123456789"], ["a", "a@b.co", "0123456789"], ["ab", "a@b", "0123456789"], ["ab", "a@b.co", "short"]] as const)
    assert.equal("value" in sv.validateContact({ name, email, msg, website: "" }), browserContact({ name, email, msg, website: "" }) === null);
});
test("parseMultipart: binary-safe, quoted boundary, rejects malformed", () => {
  const data = Buffer.from([0, 1, 2, 13, 10, 45, 45, 255]);
  const m = multipart([{ name: "file", filename: "a.bin", type: "application/octet-stream", data }, { name: "note", data: "hi" }]);
  const parts = parseMultipart(m.body, m.ct);
  assert.ok(parts);
  assert.deepEqual(parts![0].data, data);
  assert.equal(parts![1].filename, null);
  assert.equal(parts![1].data.toString(), "hi");
  assert.equal(parseMultipart(m.body, m.ct.replace("boundary=", 'boundary="') + '"')?.length, 2);
  assert.equal(parseMultipart(Buffer.from("x"), m.ct), null);
  assert.equal(parseMultipart(m.body, "multipart/form-data"), null);
  assert.equal(parseMultipart(m.body.subarray(0, m.body.length - 20), m.ct), null);
});
test("limiter: fixed window, blocked() does not consume, prunes", () => {
  let t = 0;
  const l = createLimiter({ windowMs: 100, max: 2, now: () => t });
  assert.equal(l.hit("a").ok, true); assert.equal(l.hit("a").ok, true);
  const r = l.hit("a"); assert.equal(r.ok, false); assert.ok(r.retryAfter >= 1);
  assert.equal(l.hit("b").ok, true);
  assert.equal(l.blocked("a"), true); assert.equal(l.blocked("b"), false);
  t = 150; assert.equal(l.hit("a").ok, true); assert.equal(l.blocked("a"), false);
});

// ---------- the website reads what the server writes ----------
test("shared file contract: an edit through the API is what lib/content getStore() returns (site and server share data/content.json)", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "site-"));
  const cwd = process.cwd();
  process.chdir(root); // lib/content resolves data/content.json from process.cwd() at import time
  const app = createApp({ token: TOKEN, dataDir: path.join(root, "data"), seedFile: SEED, allowedOrigins: [], now: () => clock } as never);
  const s = http.createServer(app.handler as never);
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  await app.ready;
  const url = `http://127.0.0.1:${(s.address() as { port: number }).port}`;
  try {
    const { getStore } = await import("../lib/content");
    assert.equal((await (await getStore()).getText("hero.eyebrow"))?.ar, (seed.texts as Record<string, { ar: string }>)["hero.eyebrow"].ar, "before: the site sees the seed copy");
    assert.equal((await fetch(url + "/texts/hero.eyebrow", { method: "PUT", headers: { ...auth, ...J }, body: JSON.stringify({ ar: "نص من الأدمن", en: "From admin" }) })).status, 200);
    assert.deepEqual(await (await getStore()).getText("hero.eyebrow"), { ar: "نص من الأدمن", en: "From admin" });
    const w = { id: "w5", category: "social", order: 5, title: { ar: "5" }, desc: { ar: "" }, tag: null, video: "/assets/x.mp4", poster: null };
    assert.equal((await fetch(url + "/collections/works/w5", { method: "PUT", headers: { ...auth, ...J }, body: JSON.stringify(w) })).status, 200);
    assert.equal((await (await getStore()).list("works")).some((x) => x.id === "w5"), true);
    await fetch(url + "/collections/works/w5", { method: "DELETE", headers: auth });
    assert.equal((await (await getStore()).list("works")).some((x) => x.id === "w5"), false);
  } finally { s.close(); process.chdir(cwd); rmSync(root, { recursive: true, force: true }); }
});

test("prototype pollution attempts are refused or harmless", async () => {
  const evil = '{"id":"x1","name":"n","percent":1,"__proto__":{"polluted":true}}';
  assert.equal((await fetch(base + "/collections/skills/x1", { method: "PUT", headers: { ...auth, ...J }, body: evil })).status, 422);
  assert.equal((await fetch(base + "/texts/hero.title", { method: "PUT", headers: { ...auth, ...J }, body: '{"ar":"x","__proto__":{"polluted":true}}' })).status, 422);
  assert.equal((await call("PUT", "/texts/__proto__", { ar: "x" })).status, 422);
  assert.equal((await call("PUT", "/collections/__proto__/x", { id: "x" })).status, 404);
  assert.equal((await call("PUT", "/texts/constructor", { ar: "ok" })).status, 200);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(content().texts, "constructor"), true);
});
