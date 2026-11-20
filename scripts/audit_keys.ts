// STATUS: UNVERIFIED. Usage: npx tsx scripts/audit_keys.ts  (exit 1 only on missingKeys: a code reference to a key the seed lacks). Unused keys and hardcoded text are reported for the owner.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { auditKeys } from "../lib/audit/key-audit";

const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? (["node_modules", ".next", "tests"].includes(n) ? [] : walk(p)) : /\.(tsx?|css)$/.test(n) ? [p] : []; });
const files: Record<string, string> = {}; for (const d of ["app", "components", "lib"]) for (const f of walk(d)) if (!f.includes("admin"))   // admin is an English-only tool, audited separately
  files[f] = readFileSync(f, "utf8");
const seed = JSON.parse(readFileSync("content/seed.json", "utf8"));
const r = auditKeys(Object.keys(seed.texts), files, ["brief.", "testimonials.", "about."], [...Object.keys(seed.collections ?? {}), ...Object.keys(seed.media ?? {})]);
console.log(JSON.stringify(r, null, 2));
console.log(`unused:${r.unusedKeys.length} missing:${r.missingKeys.length} hardcoded:${r.hardcoded.length}`);
process.exit(r.missingKeys.length ? 1 : 0);
