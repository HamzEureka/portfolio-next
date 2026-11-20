// STATUS: UNVERIFIED (Claude proposal). Usage: npx tsx scripts/audit_theme.ts [--md qa/v9-light-theme-findings.md]
import { promises as fs } from "node:fs";
import path from "node:path";
import { scanCss } from "../lib/audit/css-scan";
import { findLiteralColors, toMarkdown } from "../lib/theme-audit";

async function main() {
  const parts = ["# Light-theme audit (heuristic: does a [data-theme=light] rule exist for the same selector+property?)", ""];
  const files = ["app/globals.css", "app/enhancements.css", "app/skills.css"];
  const all = new Map(await Promise.all(files.map(async (f) => [f, scanCss(await fs.readFile(path.join(process.cwd(), f), "utf8"))] as const)));
  const everything = [...all.values()].flat();
  for (const [f, rules] of all) parts.push(toMarkdown(f, findLiteralColors(rules, everything)));
  const md = parts.join("\n"), i = process.argv.indexOf("--md");
  if (i > 0) await fs.writeFile(process.argv[i + 1], md, "utf8"); else console.log(md);
}
main();
