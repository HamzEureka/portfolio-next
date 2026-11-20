// STATUS: UNVERIFIED (Claude proposal). Ported from v4 js/enhancements.js (theme part); parity tests: tests/v9-theme.test.ts
import type { ClassListLike } from "./enh-contract";

export const THEME_KEY = "portfolio-theme";                 // same key as v4
export type Theme = "dark" | "light";
export const DEFAULT_THEME: Theme = "dark";                 // v4: `store() || 'dark'` (OS preference is NOT consulted)
export const THEME_ANIM_MS = 450;

export interface RootLike { dataset: { theme?: string }; classList: ClassListLike }
export interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }

/** Only "light" selects the light palette (CSS has no other theme), so anything else is normalised to dark. */
export const normalizeTheme = (v: unknown): Theme => (v === "light" ? "light" : "dark");
export const nextTheme = (cur: string | undefined): Theme => (cur === "light" ? "dark" : "light");

export function readStoredTheme(storage: StorageLike | null | undefined): Theme {
  try { return normalizeTheme(storage?.getItem(THEME_KEY)); } catch { return DEFAULT_THEME; }
}
export function initTheme(root: RootLike, storage: StorageLike | null | undefined): Theme {
  const t = readStoredTheme(storage); root.dataset.theme = t; return t;
}

/** Click handler of the toggle button (v4 order: add .theme-anim, set data-theme, store, remove .theme-anim after 450ms). */
export function toggleTheme(env: { root: RootLike; storage: StorageLike | null | undefined; setTimeout(f: () => void, ms: number): unknown }): Theme {
  const next = nextTheme(env.root.dataset.theme);
  env.root.classList.add("theme-anim");
  env.root.dataset.theme = next;
  try { env.storage?.setItem(THEME_KEY, next); } catch { /* storage blocked: theme still switches for this visit */ }
  env.setTimeout(() => env.root.classList.remove("theme-anim"), THEME_ANIM_MS);
  return next;
}

/** Inline <head> script: sets data-theme before first paint (no flash). Needs `suppressHydrationWarning` on <html>. */
export const THEME_INIT_SCRIPT =
  `(function(){var d=document.documentElement;try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});d.dataset.theme=t==='light'?'light':'dark'}catch(e){d.dataset.theme='dark'}})();`;
