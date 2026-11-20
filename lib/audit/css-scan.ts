// STATUS: UNVERIFIED (Claude proposal). Small CSS scanner for audit scripts (not a full CSS parser).
export interface Decl { prop: string; value: string; line: number }
export interface Rule { selector: string; context: string | null; decls: Decl[]; line: number }

/** Replace comments by spaces (newlines kept so line numbers stay right). */
export function stripComments(css: string): string {
  let out = "", i = 0, q: string | null = null;
  while (i < css.length) {
    const c = css[i];
    if (q) { out += c; if (c === "\\") { out += css[i + 1] ?? ""; i += 2; continue; } if (c === q) q = null; i++; continue; }
    if (c === '"' || c === "'") { q = c; out += c; i++; continue; }
    if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2), stop = end < 0 ? css.length : end + 2;
      out += css.slice(i, stop).replace(/[^\n]/g, " "); i = stop; continue;
    }
    out += c; i++;
  }
  return out;
}

/** Split on `;` at paren/quote depth 0. */
function splitDecls(body: string, firstLine: number): Decl[] {
  const res: Decl[] = [];
  let depth = 0, q: string | null = null, start = 0;
  const push = (end: number) => {
    const piece = body.slice(start, end), colon = piece.indexOf(":");
    if (colon > 0 && piece.trim()) {
      const lead = piece.length - piece.trimStart().length;
      const line = firstLine + (body.slice(0, start + lead).match(/\n/g)?.length ?? 0);
      res.push({ prop: piece.slice(0, colon).trim().toLowerCase(), value: piece.slice(colon + 1).trim(), line });
    }
  };
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (c === ";" && depth === 0) { push(i); start = i + 1; }
  }
  push(body.length);
  return res;
}

/** Flat list of style rules with their enclosing at-rule (e.g. "@media (max-width:720px)"), one level of nesting per at-rule. */
export function scanCss(source: string): Rule[] {
  const css = stripComments(source);
  const rules: Rule[] = [];
  const ctx: string[] = [];
  let line = 1, buf = "", bufLine = 1, q: string | null = null;
  let rule: { selector: string; line: number; body: string; bodyLine: number; depth: number } | null = null;
  let depth = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "\n") line++;
    if (rule) {
      if (q) { rule.body += c; if (c === "\\") { rule.body += css[++i] ?? ""; } else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; rule.body += c; continue; }
      if (c === "{") { rule.depth++; rule.body += c; continue; }
      if (c === "}") {
        if (rule.depth > 0) { rule.depth--; rule.body += c; continue; }
        rules.push({ selector: rule.selector.replace(/\s+/g, " "), context: ctx.length ? ctx.join(" > ") : null, decls: splitDecls(rule.body, rule.bodyLine), line: rule.line });
        rule = null; buf = ""; depth--; continue;
      }
      rule.body += c; continue;
    }
    if (q) { buf += c; if (c === "\\") buf += css[++i] ?? ""; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; buf += c; continue; }
    if (c === "{") {
      const header = buf.trim();
      if (/^@(media|supports|container|layer)\b/i.test(header) || /^@keyframes\b/i.test(header)) { ctx.push(header.replace(/\s+/g, " ")); depth++; }
      else { rule = { selector: header, line: bufLine, body: "", bodyLine: line, depth: 0 }; depth++; }
      buf = ""; continue;
    }
    if (c === "}") { if (ctx.length) ctx.pop(); depth--; buf = ""; continue; }
    if (c === ";") { buf = ""; continue; }                // e.g. @import / @charset
    if (!buf.trim() && c.trim()) bufLine = line;
    buf += c;
  }
  return rules;
}

const COLOR_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?)\([^)]*\)/g;
/** Literal colors in a declaration value (hex / rgb(a) / hsl(a)); `var(--x)` is not a literal. */
export const literalColors = (value: string): string[] => value.match(COLOR_RE) ?? [];
