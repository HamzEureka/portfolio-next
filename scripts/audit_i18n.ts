// STATUS: UNVERIFIED (Claude proposal). Usage: npx tsx scripts/audit_i18n.ts [--md qa/i18n-audit.md]
import { promises as fs } from "node:fs";
import path from "node:path";
import { auditI18n, isBlocking, toMarkdown } from "../lib/i18n-audit";

async function main() {
  const seed = JSON.parse(await fs.readFile(path.join(process.cwd(), "content", "seed.json"), "utf8"));
  const findings = auditI18n(seed);
  const md = toMarkdown(findings);
  const i = process.argv.indexOf("--md");
  if (i > 0) await fs.writeFile(process.argv[i + 1], md, "utf8"); else console.log(md);
  const blocking = findings.filter(isBlocking);
  console.log(`\nblocking: ${blocking.length}`);
  process.exit(blocking.length ? 1 : 0);
}
main();
