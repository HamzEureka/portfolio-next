import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { scanCss } from "../lib/audit/css-scan";
import { findLiteralColors } from "../lib/theme-audit";

test("theme audit: variables are ignored, light overrides in another file count, others are reported", () => {
  const g = scanCss(`.a{ color:#fff; border:1px solid var(--line) } .b{ background:rgba(1,2,3,.5) } :root{ --x:#123456 }`);
  const e = scanCss(`[data-theme=light] .a{ color:#000 }`);
  const f = findLiteralColors(g, [...g, ...e]);
  assert.deepEqual(f.map((x) => [x.selector, x.prop, x.themed]), [[".a", "color", true], [".b", "background", false]]);
});

test("theme audit on the real stylesheets: header.site-nav and .btn-primary are themed by enhancements.css", async () => {
  const read = async (p: string) => scanCss(await fs.readFile(path.join(process.cwd(), p), "utf8"));
  const g = await read("app/globals.css");
  const all = [...g, ...(await read("app/enhancements.css"))];
  const f = findLiteralColors(g, all);
  assert.equal(f.find((x) => x.selector === "header.site-nav")?.themed, true);
  assert.equal(f.find((x) => x.selector === ".btn-primary")?.themed, true);
});
