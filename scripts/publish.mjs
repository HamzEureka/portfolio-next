#!/usr/bin/env node
// Publish: builds a static copy of the public site and deploys it to Cloudflare (Workers Static Assets).
// Usage: node scripts/publish.mjs [--no-deploy]   Needs: ffmpeg (only for big videos), Node, `npx wrangler login` once.
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureUnderLimit, DEFAULT_MAX_BYTES } from "./lib/compress.mjs";
import { rewriteUploads, HEADERS_FILE, ROOT_HTML, wranglerConfig } from "./lib/publish-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORK = path.join(ROOT, ".publish"), BUILD = path.join(WORK, "build"), CACHE = path.join(WORK, "video-cache");
const STATUS = path.join(WORK, "status.json");
const noDeploy = process.argv.includes("--no-deploy");
const SITE_NAME = process.env.CF_WORKER_NAME || "yossef-portfolio";
const UPLOADS = path.resolve(process.env.UPLOADS_DIR || path.join(ROOT, "data", "uploads"));

const setStatus = async (state, message, extra = {}) => { await fs.mkdir(WORK, { recursive: true }); await fs.writeFile(STATUS, JSON.stringify({ state, message, at: new Date().toISOString(), ...extra })); console.log(`[${state}] ${message}`); };
const run = (cmd, args, cwd) => new Promise((res, rej) => {
  const p = spawn(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
  p.on("error", rej); p.on("close", (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${args.join(" ")} failed (${c})`))));
});
const exists = (p) => fs.access(p).then(() => true, () => false);
const SKIP = new Set(["node_modules", ".next", ".git", ".publish", "out", "data", ".overlay-v12", "server"]);

async function copyProject() {
  await fs.rm(BUILD, { recursive: true, force: true });
  await fs.mkdir(BUILD, { recursive: true });
  for (const e of await fs.readdir(ROOT, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name.startsWith(".env")) continue;
    await fs.cp(path.join(ROOT, e.name), path.join(BUILD, e.name), { recursive: true });
  }
  await fs.symlink(path.join(ROOT, "node_modules"), path.join(BUILD, "node_modules"), process.platform === "win32" ? "junction" : "dir");
}

async function main() {
  await setStatus("running", "جاري التحضير…");
  const contentFile = path.join(ROOT, "data", "content.json");
  let content = {};
  if (await exists(contentFile)) content = JSON.parse(await fs.readFile(contentFile, "utf8"));
  const { content: snapshot, files } = rewriteUploads(content, "/media");

  await copyProject();
  await fs.rm(path.join(BUILD, "app", "admin"), { recursive: true, force: true });
  await fs.rm(path.join(BUILD, "app", "route.ts"), { force: true });
  for (const f of await walk(path.join(BUILD, "app"))) {
    if (!/\.(tsx?|mjs)$/.test(f)) continue;
    const s = await fs.readFile(f, "utf8"), t = s.replace(/^export const dynamic\s*=\s*["']force-dynamic["'];?\s*$/gm, "");
    if (s !== t) await fs.writeFile(f, t);
  }
  await fs.writeFile(path.join(BUILD, "next.config.ts"), `import type { NextConfig } from "next";
const config: NextConfig = { output: "export", trailingSlash: true, images: { unoptimized: true } };
export default config;
`);
  await fs.mkdir(path.join(BUILD, "data"), { recursive: true });
  await fs.writeFile(path.join(BUILD, "data", "content.json"), JSON.stringify(snapshot, null, 2));

  // media: copy, compressing videos above the limit
  const media = path.join(BUILD, "public", "media"); await fs.mkdir(media, { recursive: true });
  const report = [];
  for (const [i, f] of files.entries()) {
    const src = path.join(UPLOADS, f);
    if (!(await exists(src))) { console.warn(`تنبيه: الملف ${f} غير موجود في مجلد الرفع، سيتم تجاهله.`); continue; }
    await setStatus("running", `معالجة الملفات ${i + 1} من ${files.length}…`);
    const isVideo = /\.(mp4|webm)$/i.test(f);
    const r = isVideo ? await ensureUnderLimit(src, { cacheDir: CACHE, maxBytes: DEFAULT_MAX_BYTES, log: console.log }) : { path: src, bytes: (await fs.stat(src)).size };
    if (r.bytes > DEFAULT_MAX_BYTES) throw new Error(`الملف ${f} أكبر من 24 ميغا ولا يمكن ضغطه (ليس فيديو).`);
    // compressed output is always mp4; keep the same public name
    await fs.copyFile(r.path, path.join(media, f));
    report.push({ file: f, bytes: r.bytes, compressed: !!r.compressed });
  }

  await setStatus("running", "جاري بناء الموقع…");
  await run("npx", ["next", "build"], BUILD);
  const outDir = path.join(BUILD, "out");
  if (!(await exists(outDir))) throw new Error("لم يُنتج البناء مجلد out.");
  await fs.writeFile(path.join(outDir, "index.html"), ROOT_HTML);
  await fs.writeFile(path.join(outDir, "_headers"), HEADERS_FILE);
  await fs.writeFile(path.join(BUILD, "wrangler.jsonc"), wranglerConfig({ name: SITE_NAME, assetsDir: "./out" }));

  if (noDeploy) { await setStatus("done", "تم البناء (بدون رفع).", { report, out: outDir }); return; }
  await setStatus("running", "جاري الرفع إلى Cloudflare…");
  await run("npx", ["--yes", "wrangler@4", "deploy"], BUILD);
  await setStatus("done", "تم نشر التعديلات. قد يستغرق ظهورها دقيقة.", { report });
}

async function walk(d) { const o = []; for (const e of await fs.readdir(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) o.push(...await walk(p)); else o.push(p); } return o; }

main().catch(async (e) => { await setStatus("error", String(e.message || e).slice(0, 500)); process.exit(1); });
