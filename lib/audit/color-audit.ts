// STATUS: UNVERIFIED (Claude proposal). Rule 2 audit: literal colors in the NEW stylesheets only (globals.css is locked and has 34 known literals).
import { scanCss } from "./css-scan";
const COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/;
export interface ColorHit { file: string; line: number; prop: string; value: string }
export function auditColors(files: Record<string, string>): ColorHit[] {
  const out: ColorHit[] = [];
  for (const [file, css] of Object.entries(files)) for (const r of scanCss(css)) for (const d of r.decls) if (COLOR.test(d.value)) out.push({ file, line: d.line, prop: d.prop, value: d.value });
  return out;
}
