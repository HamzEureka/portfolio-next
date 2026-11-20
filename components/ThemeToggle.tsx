// STATUS: UNVERIFIED (Claude proposal; not type-checked against real @types/react / next)
"use client";
import { toggleTheme, type RootLike, type StorageLike } from "@/lib/theme";

/** v4 button (`button.theme-btn`, moon + sun svgs; CSS in app/enhancements.css picks the visible one from data-theme). Stateless on purpose: no hydration mismatch. */
export default function ThemeToggle({ label }: { label: string }) {
  function onClick() {
    let storage: StorageLike | null = null;
    try { storage = window.localStorage; } catch { /* blocked */ }
    toggleTheme({ root: document.documentElement as unknown as RootLike, storage, setTimeout: (f, ms) => window.setTimeout(f, ms) });
  }
  return (
    <button type="button" className="theme-btn" aria-label={label} onClick={onClick}>
      <svg className="moon" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      <svg className="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx={12} cy={12} r={4} /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
    </button>
  );
}
