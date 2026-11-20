// STATUS: UNVERIFIED (Claude proposal). Rule 4 audit: every text has a dotted key. Regex-based (no AST): reports candidates, a human decides.
export interface KeyAudit { unusedKeys: string[]; missingKeys: string[]; hardcoded: { file: string; line: number; text: string }[] }
const KEY_LIT = /["'`]([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)["'`]/g;
const TEXTY = /[؀-ۿ]|[A-Za-z]{3,}[  ][A-Za-z]{2,}/;

export function auditKeys(seedKeys: string[], files: Record<string, string>, dynamicPrefixes: string[] = [], otherKeys: string[] = []): KeyAudit {
  const stripComments = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const used = new Set<string>();
  for (const src of Object.values(files)) for (const m of stripComments(src).matchAll(KEY_LIT)) used.add(m[1]);
  const keys = new Set([...seedKeys, ...otherKeys]);   // otherKeys: collection and media-slot names (not text keys)
  const unusedKeys = seedKeys.filter((k) => !used.has(k) && !dynamicPrefixes.some((p) => k.startsWith(p))).sort();
  const missingKeys = [...used].filter((k) => /^(nav|hero|about|skills|works|process|testimonials|contact|contactForm|brief|review|share|footer|theme|lang|meta|common)\./.test(k) && !keys.has(k) && !k.endsWith(".")).sort();
  const hardcoded: KeyAudit["hardcoded"] = [];
  for (const [file, src] of Object.entries(files)) {
    if (!/\.tsx$/.test(file)) continue;
    src.split("\n").forEach((ln, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(ln) || /\bimport\b/.test(ln)) return;
      for (const m of ln.matchAll(/>([^<>{}]+)</g)) if (TEXTY.test(m[1])) hardcoded.push({ file, line: i + 1, text: m[1].trim() });                 // JSX text children
      for (const m of ln.matchAll(/\b(?:alt|title|placeholder|aria-label)="([^"]+)"/g)) if (TEXTY.test(m[1]) || /^[a-z]{3,}$/i.test(m[1])) hardcoded.push({ file, line: i + 1, text: `${m[0]}` });
    });
  }
  return { unusedKeys, missingKeys, hardcoded };
}
