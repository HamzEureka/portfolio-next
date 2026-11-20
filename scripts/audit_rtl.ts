// STATUS: UNVERIFIED (Claude proposal). Usage: npx tsx scripts/audit_rtl.ts [--md qa/v8-rtl-findings.md]
// Read-only: lists physical left/right CSS so the owner knows what to look at in /en. It cannot judge the visual result.
import { promises as fs } from "node:fs";
import path from "node:path";
import { scanCss } from "../lib/audit/css-scan";
import { findPhysical, toMarkdown } from "../lib/rtl-audit";

async function main() {
  const files = ["app/globals.css", "app/enhancements.css", "app/skills.css"];
  const parts = ["# RTL/LTR audit (heuristic)", "", "Symmetric pairs (`left:0;right:0`) and `left:50%+translateX(-50%)` centering are skipped. v4 had only 2 LTR rules (`html[dir=ltr] .hero h1`, `body`).", ""];
  let total = 0;
  for (const f of files) {
    const css = await fs.readFile(path.join(process.cwd(), f), "utf8");
    const found = findPhysical(scanCss(css));
    total += found.length;
    parts.push(toMarkdown(f, found));
  }
  const md = parts.join("\n");
  const i = process.argv.indexOf("--md");
  if (i > 0) await fs.writeFile(process.argv[i + 1], md, "utf8"); else console.log(md);
  console.log(`total: ${total}`);
}
main();
