// Cloudinary helpers, zero dependencies. Used for (1) signing browser uploads of images/videos and
// (2) keeping small JSON files (content, reviews, messages) so they survive Render's ephemeral disk.
import crypto from "node:crypto";

/** CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name> */
export function parseCloudinaryUrl(u) {
  const m = /^cloudinary:\/\/([^:@\/\s]+):([^@\/\s]+)@([^\/\s?]+)/.exec(String(u || "").trim());
  return m ? { apiKey: m[1], apiSecret: m[2], cloudName: m[3] } : null;
}

/** Cloudinary signature: sha1 of "k=v&k=v" (keys sorted, empty values skipped) + api_secret. */
export function signParams(params, apiSecret) {
  const s = Object.keys(params).filter((k) => params[k] !== undefined && params[k] !== "").sort().map((k) => `${k}=${params[k]}`).join("&");
  return crypto.createHash("sha1").update(s + apiSecret).digest("hex");
}

export const ALLOWED_FORMATS = "jpg,jpeg,png,webp,gif,mp4,webm";

/** What the browser needs to upload one image/video straight to Cloudinary (the secret never leaves the server). */
export function signBrowserUpload({ cloudName, apiKey, apiSecret }, now = Date.now()) {
  const params = { allowed_formats: ALLOWED_FORMATS, folder: "portfolio", timestamp: Math.floor(now / 1000) };
  return { url: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, fields: { ...params, api_key: apiKey, signature: signParams(params, apiSecret) } };
}

/** Key-value remote storage for small JSON files. `fetchImpl` is injectable for tests. */
export function createRemoteStore({ cloudName, apiKey, apiSecret }, fetchImpl = fetch) {
  const idFor = (name) => `portfolio/data-${name}`;
  const api = `https://api.cloudinary.com/v1_1/${cloudName}`;
  return {
    async push(name, buf) {
      const p = { invalidate: "true", overwrite: "true", public_id: idFor(name), timestamp: Math.floor(Date.now() / 1000) };
      const fd = new FormData();
      for (const [k, v] of Object.entries(p)) fd.set(k, String(v));
      fd.set("api_key", apiKey); fd.set("signature", signParams(p, apiSecret));
      fd.set("file", new Blob([buf]), name);
      const r = await fetchImpl(`${api}/raw/upload`, { method: "POST", body: fd });
      if (!r.ok) throw new Error(`cloudinary push ${name}: HTTP ${r.status} ${(await r.text().catch(() => "")).slice(0, 200)}`);
    },
    /** Returns a Buffer, or null when the file was never stored. */
    async pull(name) {
      const auth = "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
      const meta = await fetchImpl(`${api}/resources/raw/upload/${idFor(name)}`, { headers: { Authorization: auth } });
      if (meta.status === 404) return null;
      if (!meta.ok) throw new Error(`cloudinary lookup ${name}: HTTP ${meta.status}`);
      const { secure_url } = await meta.json();
      const f = await fetchImpl(secure_url);
      if (!f.ok) throw new Error(`cloudinary download ${name}: HTTP ${f.status}`);
      return Buffer.from(await f.arrayBuffer());
    },
  };
}

/** AES-256-GCM so that reviews/messages stored in a public raw URL are unreadable without ADMIN_TOKEN. */
const keyOf = (secret) => crypto.createHash("sha256").update("portfolio-remote:" + secret).digest();
export function seal(buf, secret) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", keyOf(secret), iv);
  const enc = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]);
}
export function unseal(buf, secret) {
  const d = crypto.createDecipheriv("aes-256-gcm", keyOf(secret), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]);
}
/** Unguessable name for private files. */
export const privateName = (name, secret) => `${crypto.createHmac("sha256", secret).update(name).digest("hex").slice(0, 16)}-${name}`;
