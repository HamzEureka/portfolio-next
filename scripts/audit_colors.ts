// STATUS: UNVERIFIED. Usage: npx tsx scripts/audit_colors.ts  (exit 1 if a new stylesheet has a literal color). Checks every app/*.css except the locked globals.css.
import { readFileSync, readdirSync } from "node:fs";
import { auditColors } from "../lib/audit/color-audit";
const files: Record<string, string> = {};
for (const d of ["app", "app/admin"]) for (const n of readdirSync(d)) if (n.endsWith(".css") && n !== "globals.css") files[`${d}/${n}`] = readFileSync(`${d}/${n}`, "utf8");
const hits = auditColors(files); console.log(JSON.stringify(hits, null, 2)); console.log(`${Object.keys(files).length} files, ${hits.length} literal colors`);
process.exit(hits.length ? 1 : 0);
