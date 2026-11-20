// STATUS: UNVERIFIED (Claude proposal). Finds translation gaps in content/seed.json.
import type { LText } from "./content/types";

const ARABIC = /[؀-ۿ]/;
export type Kind = "needs-en" | "neutral-no-en" | "en-has-arabic" | "en-equals-ar" | "empty";
export interface Finding { path: string; kind: Kind; ar: string; en?: string }

const isLText = (v: unknown): v is LText => !!v && typeof v === "object" && typeof (v as LText).ar === "string" && Object.keys(v as object).every((k) => k === "ar" || k === "en");

/** Every {ar,en?} object in the seed (texts + any collection field), with a readable path. */
export function collectLTexts(seed: { texts: Record<string, unknown>; collections: Record<string, unknown[]> }): Array<{ path: string; v: LText }> {
  const out: Array<{ path: string; v: LText }> = [];
  const walk = (v: unknown, path: string) => {
    if (isLText(v)) { out.push({ path, v }); return; }
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${(x as { id?: string })?.id ?? i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
  };
  for (const [k, v] of Object.entries(seed.texts)) walk(v, `texts.${k}`);
  for (const [name, items] of Object.entries(seed.collections)) walk(items, `collections.${name}`);
  return out;
}

export function classify(path: string, v: LText): Finding | null {
  const f = (kind: Kind): Finding => ({ path, kind, ar: v.ar, en: v.en });
  if (v.ar.trim() === "" && !v.en) return f("empty");
  if (v.en === undefined) return ARABIC.test(v.ar) ? f("needs-en") : f("neutral-no-en");
  if (ARABIC.test(v.en)) return f("en-has-arabic");
  if (v.en === v.ar) return f("en-equals-ar");
  return null;
}

export function auditI18n(seed: Parameters<typeof collectLTexts>[0]): Finding[] {
  return collectLTexts(seed).map(({ path, v }) => classify(path, v)).filter((x): x is Finding => !!x);
}

/** Intentionally Arabic-only (D12: testimonials, client names/roles). */
export const ALLOWED_NEEDS_EN: RegExp[] = [/^collections\.testimonials\[/];
/** Arabic inside `en` on purpose: the language button label is written in the TARGET language (existing v5 behavior). */
export const ALLOWED_ARABIC_IN_EN: RegExp[] = [/^texts\.lang\.switchTo\.ar$/];
export const isBlocking = (f: Finding) =>
  (f.kind === "needs-en" && !ALLOWED_NEEDS_EN.some((r) => r.test(f.path))) ||
  (f.kind === "en-has-arabic" && !ALLOWED_ARABIC_IN_EN.some((r) => r.test(f.path)));

export function toMarkdown(findings: Finding[]): string {
  const order: Kind[] = ["needs-en", "en-has-arabic", "en-equals-ar", "neutral-no-en", "empty"];
  const lines = ["# i18n audit", ""];
  for (const k of order) {
    const xs = findings.filter((f) => f.kind === k);
    if (!xs.length) continue;
    lines.push(`## ${k} (${xs.length})`);
    for (const f of xs) lines.push(`- \`${f.path}\`${isBlocking(f) ? " **BLOCKING**" : ""} — ar: ${JSON.stringify(f.ar.slice(0, 60))}${f.en !== undefined ? ` · en: ${JSON.stringify(f.en.slice(0, 60))}` : ""}`);
    lines.push("");
  }
  return lines.join("\n");
}
