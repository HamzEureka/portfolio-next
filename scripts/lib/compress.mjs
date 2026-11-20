// Video compression for publishing: every video must end up <= maxBytes (Cloudflare static assets cap files at 25 MiB).
// Needs ffmpeg + ffprobe on PATH. Zero npm dependencies. Originals are never modified; results are cached by file name/size/mtime.
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

export const DEFAULT_MAX_BYTES = 24 * 1024 * 1024; // 1 MiB below the 25 MiB platform cap

/** Pure: choose a video bitrate/height that fits `maxBytes` for a clip of `durationSec`. */
export function planVideo({ durationSec, maxBytes = DEFAULT_MAX_BYTES, audioBps = 96_000, safety = 0.92 }) {
  if (!(durationSec > 0)) return { ok: false, reason: "no-duration" };
  const videoBps = Math.floor((maxBytes * 8 * safety) / durationSec - audioBps);
  if (videoBps < 150_000) return { ok: false, reason: "too-long", videoBps };
  const height = videoBps >= 2_500_000 ? 1080 : videoBps >= 1_000_000 ? 720 : videoBps >= 500_000 ? 540 : 480;
  return { ok: true, videoBps, height };
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err = (err + d).slice(-4000)));
    p.on("error", (e) => reject(new Error(e.code === "ENOENT" ? `${cmd} not found. Install ffmpeg and make sure it is on PATH.` : String(e))));
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err.slice(-600)}`))));
  });
}

export async function probeDuration(file) {
  const out = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  const d = parseFloat(out.trim());
  return Number.isFinite(d) ? d : 0;
}

/** Returns the path of a file <= maxBytes: the source itself when small enough, else a cached compressed mp4. */
export async function ensureUnderLimit(src, { cacheDir, maxBytes = DEFAULT_MAX_BYTES, log = () => {} }) {
  const st = await fs.stat(src);
  if (st.size <= maxBytes) return { path: src, compressed: false, bytes: st.size };
  await fs.mkdir(cacheDir, { recursive: true });
  const key = crypto.createHash("sha1").update(`${path.basename(src)}|${st.size}|${st.mtimeMs}|${maxBytes}`).digest("hex").slice(0, 16);
  const out = path.join(cacheDir, `${key}.mp4`);
  try { const c = await fs.stat(out); if (c.size <= maxBytes) return { path: out, compressed: true, bytes: c.size, cached: true }; } catch {}
  const durationSec = await probeDuration(src);
  let safety = 0.92;
  for (let attempt = 0; attempt < 3; attempt++, safety -= 0.1) {
    const plan = planVideo({ durationSec, maxBytes, safety });
    if (!plan.ok) throw new Error(`cannot fit ${path.basename(src)} (${Math.round(durationSec)} s) into ${Math.round(maxBytes / 1048576)} MB (${plan.reason}). Use a shorter clip.`);
    const v = String(plan.videoBps), vf = `scale=-2:min(ih\\,${plan.height})`, plog = path.join(cacheDir, `${key}.pass`);
    log(`compress ${path.basename(src)}: ${Math.round(durationSec)} s -> ${Math.round(plan.videoBps / 1000)} kbps, max ${plan.height}p (try ${attempt + 1})`);
    const base = ["-y", "-i", src, "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-pix_fmt", "yuv420p", "-b:v", v, "-passlogfile", plog];
    await run("ffmpeg", [...base, "-pass", "1", "-an", "-f", "null", "-"]);
    await run("ffmpeg", [...base, "-maxrate", String(Math.floor(plan.videoBps * 1.5)), "-bufsize", String(plan.videoBps * 2), "-pass", "2",
      "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", out]);
    for (const f of await fs.readdir(cacheDir)) if (f.startsWith(`${key}.pass`)) await fs.rm(path.join(cacheDir, f), { force: true });
    const r = await fs.stat(out);
    if (r.size <= maxBytes) return { path: out, compressed: true, bytes: r.size };
  }
  throw new Error(`could not get ${path.basename(src)} under ${Math.round(maxBytes / 1048576)} MB`);
}
