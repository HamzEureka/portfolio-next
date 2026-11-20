// STATUS: UNVERIFIED (Claude, M11). End-to-end smoke test against the RUNNING API server and website (same machine, repo root).
// Usage (PowerShell):  $env:ADMIN_TOKEN="<your token>"; npm run smoke
// Options via env: API (default http://127.0.0.1:8000), SITE (default http://localhost:3000), CONTENT_FILE (default data/content.json).
// Changes `hero.eyebrow` temporarily and restores it; uploads one 1x1 PNG (stays in data/uploads). Exit code 1 if any step fails.
import { readFileSync } from "node:fs";

const API = (process.env.API || "http://127.0.0.1:8000").replace(/\/$/, "");
const SITE = (process.env.SITE || "http://localhost:3000").replace(/\/$/, "");
const FILE = process.env.CONTENT_FILE || "data/content.json";
const TOKEN = process.env.ADMIN_TOKEN || "";
const KEY = "hero.eyebrow";
const results = [];
async function step(name, fn) {
  try { const note = await fn(); results.push({ name, ok: true }); console.log(`PASS  ${name}${note ? "  (" + note + ")" : ""}`); }
  catch (e) { results.push({ name, ok: false }); console.log(`FAIL  ${name}\n      ${e.message}`); }
}
const must = (c, msg) => { if (!c) throw new Error(msg); };
const auth = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
const put = (body) => fetch(`${API}/texts/${KEY}`, { method: "PUT", headers: auth, body: JSON.stringify(body) });
const page = async (lang) => { const r = await fetch(`${SITE}/${lang}`); must(r.ok, `${SITE}/${lang} -> HTTP ${r.status}`); return r.text(); };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

must(TOKEN.length >= 16, "Set ADMIN_TOKEN (the same value as in server/.env) before running.");
let original;
await step("API is up (GET /health)", async () => { const r = await fetch(`${API}/health`); must(r.ok, `HTTP ${r.status}`); });
await step("write without a token is refused (401)", async () => { const r = await fetch(`${API}/texts/${KEY}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ar: "x" }) }); must(r.status === 401, `got ${r.status}`); });
await step("your token is accepted (GET /auth/check)", async () => { const r = await fetch(`${API}/auth/check`, { headers: auth }); must(r.status === 200, `got ${r.status} (wrong ADMIN_TOKEN?)`); });
await step("CORS: the site origin may call the API", async () => {
  const origin = new URL(SITE).origin;
  const r = await fetch(`${API}/texts/${KEY}`, { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "PUT" } });
  must(r.status === 204 && r.headers.get("access-control-allow-origin") === origin, `got ${r.status}; add ${origin} to ALLOWED_ORIGINS in server/.env`);
});
await step("content file is readable", async () => { original = JSON.parse(readFileSync(FILE, "utf8")).texts[KEY]; must(original && typeof original.ar === "string", `${KEY} not found in ${FILE}`); });
const marker = `SMOKE-${Date.now().toString(36)}`;
await step("admin edit reaches the website (/ar and /en)", async () => {
  must((await put({ ar: marker + "-AR", en: marker + "-EN" })).ok, "PUT failed");
  must((await page("ar")).includes(marker + "-AR"), "/ar does not show the edit (is the site started from the repo root and rendered dynamically?)");
  must((await page("en")).includes(marker + "-EN"), "/en does not show the edit");
});
await step("original text restored and gone from the website", async () => {
  must((await put(original)).ok, "restore PUT failed");
  must(!(await page("ar")).includes(marker), "marker still on /ar");
});
await step("upload a PNG and fetch it back", async () => {
  const fd = new FormData(); fd.append("file", new Blob([PNG], { type: "image/png" }), "smoke.png");
  const r = await fetch(`${API}/media/upload`, { method: "POST", headers: { Authorization: auth.Authorization }, body: fd });
  must(r.status === 201, `upload got ${r.status}`);
  const { url } = await r.json();
  const g = await fetch(url);
  must(g.ok && g.headers.get("content-type") === "image/png", `GET ${url} -> ${g.status} ${g.headers.get("content-type")}`);
  return url;
});
await step("public form rejects a bot (honeypot filled → 422)", async () => {
  const r = await fetch(`${API}/contact`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Smoke", email: "smoke@example.com", msg: "smoke test message", website: "http://bot" }) });
  must(r.status === 422, `got ${r.status}`);
});
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${failed === 0 ? "SMOKE: PASS" : `SMOKE: FAIL (${failed} step(s))`}  ${results.length - failed}/${results.length}`);
process.exit(failed === 0 ? 1 - 1 : 1);
