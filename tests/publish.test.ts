import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
// @ts-expect-error plain .mjs helpers
import { planVideo, ensureUnderLimit } from "../scripts/lib/compress.mjs";
// @ts-expect-error plain .mjs helpers
import { rewriteUploads } from "../scripts/lib/publish-core.mjs";

test("planVideo picks a bitrate that fits", () => {
  const p = planVideo({ durationSec: 60, maxBytes: 24 * 1048576 });
  assert.ok(p.ok && p.videoBps > 2_000_000 && p.height >= 720);
  assert.equal(planVideo({ durationSec: 60 * 60 * 3, maxBytes: 24 * 1048576 }).ok, false);
  assert.equal(planVideo({ durationSec: 0 }).ok, false);
});

test("rewriteUploads rewrites relative and absolute upload URLs", () => {
  const r = rewriteUploads({ a: { video: "http://localhost:8787/uploads/a-1.mp4" }, b: ["/uploads/p.webp", "https://x.com/page"], n: 3 });
  assert.deepEqual(r.files.sort(), ["a-1.mp4", "p.webp"]);
  assert.equal(r.content.a.video, "/media/a-1.mp4");
  assert.equal(r.content.b[1], "https://x.com/page");
});

test("ensureUnderLimit compresses a real video below the limit", { timeout: 120_000 }, async (t) => {
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); } catch { return t.skip("ffmpeg not installed"); }
  const dir = mkdtempSync(path.join(tmpdir(), "cmp-")), src = path.join(dir, "in.mp4");
  execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30", "-f", "lavfi", "-i", "sine=f=440", "-t", "20", "-c:v", "libx264", "-b:v", "4M", "-c:a", "aac", src], { stdio: "ignore" });
  const limit = Math.floor(statSync(src).size / 3);
  const r = await ensureUnderLimit(src, { cacheDir: path.join(dir, "c"), maxBytes: limit });
  assert.ok(r.compressed && r.bytes <= limit, `${r.bytes} > ${limit}`);
  const again = await ensureUnderLimit(src, { cacheDir: path.join(dir, "c"), maxBytes: limit });
  assert.ok(again.cached);
});
