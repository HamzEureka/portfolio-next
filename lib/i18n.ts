// STATUS: UNVERIFIED (Claude proposal; sandbox tests only)
// Pure language helpers for the /ar /en routing (D4, D7, D11). No DOM, no Next imports.
import { DEFAULT_LANG, LANGS, type Lang } from "./content/types";

/** Cookie that remembers the visitor's choice (v4 used localStorage key "portfolio-lang"). */
export const LANG_COOKIE = "portfolio-lang";
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const isLang = (x: unknown): x is Lang => typeof x === "string" && (LANGS as string[]).includes(x);
export const dirOf = (l: Lang): "rtl" | "ltr" => (l === "en" ? "ltr" : "rtl");
export const otherLang = (l: Lang): Lang => (l === "ar" ? "en" : "ar");

/** "/en/brief" -> "en"; "/" or "/foo" -> null. */
export function langFromPath(pathname: string): Lang | null {
  const seg = pathname.split("/")[1];
  return isLang(seg) ? seg : null;
}

/**
 * Same page in another language, keeping sub-path, trailing slash and hash.
 *   switchHref("/ar/brief", "en", "#x") -> "/en/brief#x"; switchHref("/", "en") -> "/en"
 * A path without a language prefix (e.g. "/admin") just gets the prefix.
 */
export function switchHref(pathname: string, target: Lang, hash = ""): string {
  const h = hash && !hash.startsWith("#") ? "#" + hash : hash;
  const p = pathname.startsWith("/") ? pathname : "/" + pathname;
  const cur = langFromPath(p);
  const rest = cur ? p.slice(1 + cur.length) : p === "/" ? "" : p;
  return `/${target}${rest === "/" ? "" : rest}${h}`;
}

/** First supported language in an Accept-Language header, highest q first; null when none matches. */
export function fromAcceptLanguage(header: string | null | undefined): Lang | null {
  if (!header) return null;
  const items = header.split(",").map((part, i) => {
    const [tag, ...params] = part.trim().split(";");
    const q = params.map((s) => s.trim()).find((s) => s.startsWith("q="));
    const w = q ? parseFloat(q.slice(2)) : 1;
    return { tag: tag.trim().toLowerCase(), q: Number.isFinite(w) ? w : 0, i };
  }).filter((x) => x.tag && x.q > 0).sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { tag } of items) { const primary = tag.split("-")[0]; if (isLang(primary)) return primary; }
  return null;
}

/** Value of cookie `name` in a Cookie request header, or null. */
export function readCookie(header: string | null | undefined, name: string): string | null {
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("="); if (i < 0) continue;
    if (part.slice(0, i).trim() === name) { try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; } }
  }
  return null;
}

/** Language for the bare "/" redirect: cookie wins; Accept-Language only when `useAcceptLanguage` (off = v4 behavior). */
export function pickLang(o: { cookie?: string | null; acceptLanguage?: string | null; useAcceptLanguage?: boolean }): Lang {
  if (isLang(o.cookie)) return o.cookie;
  if (o.useAcceptLanguage) { const a = fromAcceptLanguage(o.acceptLanguage); if (a) return a; }
  return DEFAULT_LANG;
}

/** Next `metadata.alternates` for a page. `sub` = path after the language ("", "/brief"). Needs `metadataBase` in the root layout for absolute URLs. */
export function alternatesFor(lang: Lang, sub = "") {
  const url = (l: Lang) => `/${l}${sub}`;
  return { canonical: url(lang), languages: { ar: url("ar"), en: url("en"), "x-default": url(DEFAULT_LANG) } };
}
