// STATUS: UNVERIFIED (Claude proposal). Pure validators for the admin UI (v11). The server must validate again: never trust the browser.
import type { LText } from "../content/types";

const CTRL = /[\u0000- \u007f-\u009f]/g;          // control chars and spaces are ignored by browsers inside a scheme ("java\nscript:")
/** http(s), mailto, tel, site-relative ("/x", not "//host"), "assets/x" and "#x". Everything else (javascript:, data:, vbscript:, file:) is refused. */
export function safeUrl(u: string): boolean {
  const s = u.trim(); if (!s) return false;
  const compact = s.replace(CTRL, "").toLowerCase();
  if (/^(https?:|mailto:|tel:)/.test(compact)) return true;
  if (/^[a-z][a-z0-9+.-]*:/.test(compact)) return false;       // any other scheme
  return s.startsWith("/") ? !s.startsWith("//") && !s.startsWith("/\\") : /^(assets\/|#)/.test(s);
}

export const KEY_RE = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+|\[\d+\])*$/;      // hero.title, about.stats, works.items[0]
export const validKey = (k: string) => KEY_RE.test(k);
export const validId = (id: string) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id);

export function validateLText(v: unknown, opts: { requireAr?: boolean } = {}): string | null {
  if (!v || typeof v !== "object") return "must be {ar,en?}";
  const t = v as LText;
  if (typeof t.ar !== "string") return "ar must be a string";
  if (t.en !== undefined && typeof t.en !== "string") return "en must be a string";
  if (opts.requireAr && !t.ar.trim()) return "ar is required";
  if (t.ar.length > 5000 || (t.en?.length ?? 0) > 5000) return "too long (5000)";
  return null;
}
export const validWhatsapp = (s: string) => /^\+?[\d٠-٩۰-۹\s-]{6,20}$/.test(s.trim());
export const validEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
