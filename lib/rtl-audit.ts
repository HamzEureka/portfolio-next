// STATUS: UNVERIFIED (Claude proposal). Heuristic list of direction-dependent CSS for the /en (LTR) visual review.
import type { Rule } from "./audit/css-scan";

export type PhysKind = "offset" | "margin" | "padding" | "border" | "radius" | "text-align" | "float" | "translateX" | "gradient" | "transform-origin" | "bg-position";
export interface PhysFinding { line: number; selector: string; context: string | null; prop: string; value: string; kind: PhysKind; hasLtrOverride: boolean }

const LTR_SEL = /\[dir=["']?ltr["']?\]|:dir\(ltr\)|\[lang=["']?en["']?\]/i;
const stripLtr = (s: string) => s.replace(/html\s*\[dir=["']?ltr["']?\]\s*|:root\s*\[dir=["']?ltr["']?\]\s*/gi, "").replace(/\s+/g, " ").trim();

function kindOf(prop: string, value: string): PhysKind | null {
  if (/^(left|right)$/.test(prop)) return "offset";
  if (/^margin-(left|right)$/.test(prop)) return "margin";
  if (/^padding-(left|right)$/.test(prop)) return "padding";
  if (/^border-(left|right)(-|$)/.test(prop)) return "border";
  if (/^border-(top|bottom)-(left|right)-radius$/.test(prop)) return "radius";
  if (prop === "text-align" && /^(left|right)\b/.test(value)) return "text-align";
  if ((prop === "float" || prop === "clear") && /^(left|right)\b/.test(value)) return "float";
  if (prop === "transform-origin" && /\b(left|right)\b/.test(value)) return "transform-origin";
  if ((prop === "background-position" || prop === "background") && /\b(left|right)\b/.test(value) && !/gradient/.test(value)) return "bg-position";
  if (/gradient\(/.test(value) && (/\bto (left|right)\b/.test(value) || /\b(90|270)deg\b/.test(value))) return "gradient";
  if (prop === "transform" && /translate(X|3d)?\(/.test(value) && !/translate\(\s*-?50%\s*,/.test(value) && !/translateX\(\s*-50%\s*\)/.test(value) && !/translate3d\(\s*-50%/.test(value)) {
    const m = value.match(/translateX\(\s*(-?[\d.]+)(px|%|rem|em|vw)?\s*\)/); if (m && parseFloat(m[1]) === 0) return null; return "translateX";
  }
  return null;
}

export function findPhysical(rules: Rule[]): PhysFinding[] {
  const overrides = new Set<string>();
  for (const r of rules) if (LTR_SEL.test(r.selector)) for (const sel of r.selector.split(",")) for (const d of r.decls) overrides.add(`${r.context ?? ""}|${stripLtr(sel.trim())}|${d.prop}`);
  const out: PhysFinding[] = [];
  for (const r of rules) {
    if (LTR_SEL.test(r.selector) || /^@/.test(r.selector) || (r.context ?? "").startsWith("@keyframes")) continue;
    const byProp = new Map(r.decls.map((d) => [d.prop, d.value]));
    for (const d of r.decls) {
      const kind = kindOf(d.prop, d.value); if (!kind) continue;
      const mirror = ({ left: "right", right: "left", "margin-left": "margin-right", "margin-right": "margin-left", "padding-left": "padding-right", "padding-right": "padding-left" } as Record<string, string>)[d.prop];
      if (mirror && byProp.get(mirror) === d.value) continue;                  // symmetric (left:0;right:0 etc.)
      if (d.prop === "left" && d.value === "50%" && /translate(X)?\(\s*-50%/.test(byProp.get("transform") ?? "")) continue; // centering idiom
      const has = r.selector.split(",").some((s) => overrides.has(`${r.context ?? ""}|${s.trim().replace(/\s+/g, " ")}|${d.prop}`));
      out.push({ line: d.line, selector: r.selector, context: r.context, prop: d.prop, value: d.value, kind, hasLtrOverride: has });
    }
  }
  return out;
}

export function toMarkdown(file: string, f: PhysFinding[]): string {
  const kinds = [...new Set(f.map((x) => x.kind))];
  const lines = [`## ${file} — ${f.length} direction-dependent declarations (${f.filter((x) => x.hasLtrOverride).length} already have an LTR override)`, ""];
  for (const k of kinds) {
    const xs = f.filter((x) => x.kind === k);
    lines.push(`### ${k} (${xs.length})`);
    for (const x of xs) lines.push(`- L${x.line} \`${x.selector}\`${x.context ? ` _${x.context}_` : ""}: \`${x.prop}: ${x.value}\`${x.hasLtrOverride ? " ✓override" : ""}`);
    lines.push("");
  }
  return lines.join("\n");
}
