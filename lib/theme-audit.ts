// STATUS: UNVERIFIED (Claude proposal). Literal colors that have no light-theme counterpart (SUMMARY gap 6: "34 literal colors outside variables").
import { literalColors, type Rule } from "./audit/css-scan";

const LIGHT = /\[data-theme=["']?light["']?\]/;
const norm = (s: string) => s.replace(LIGHT, "").replace(/\s+/g, " ").trim();
export interface ColorFinding { line: number; selector: string; context: string | null; prop: string; colors: string[]; themed: boolean }

/** A literal color is "themed" when some `[data-theme=light]` rule overrides the same selector + property. */
/** `overrideSource` = rules of ALL stylesheets (the light overrides live in enhancements.css, the colors in globals.css). */
export function findLiteralColors(rules: Rule[], overrideSource: Rule[] = rules): ColorFinding[] {
  const over = new Set<string>();
  for (const r of overrideSource) if (LIGHT.test(r.selector)) for (const s of r.selector.split(",")) for (const d of r.decls) over.add(`${norm(s)}|${d.prop}`);
  const out: ColorFinding[] = [];
  for (const r of rules) {
    if (LIGHT.test(r.selector) || (r.context ?? "").startsWith("@keyframes")) continue;
    for (const d of r.decls) {
      if (d.prop.startsWith("--")) continue;               // variable definitions are the intended single place
      const colors = literalColors(d.value); if (!colors.length) continue;
      out.push({ line: d.line, selector: r.selector, context: r.context, prop: d.prop, colors, themed: r.selector.split(",").every((s) => over.has(`${s.trim().replace(/\s+/g, " ")}|${d.prop}`)) });
    }
  }
  return out;
}
export function toMarkdown(file: string, f: ColorFinding[]): string {
  const un = f.filter((x) => !x.themed);
  return [`## ${file}: ${f.length} literal-color declarations, ${un.length} without a light-theme override`, "",
    ...un.map((x) => `- L${x.line} \`${x.selector}\`${x.context ? ` _${x.context}_` : ""}: \`${x.prop}\` ${x.colors.join(" ")}`), ""].join("\n");
}
