// STATUS: UNVERIFIED (Claude proposal). Ported from v4 js/enhancements.js (progress part); parity tests: tests/v9-progress.test.ts
import type { StyleLike } from "./enh-contract";

/** v4 formula verbatim: 0 when the page is not scrollable, capped at 1. (A negative scrollY from Safari overscroll gives a negative ratio, as in v4.) */
export const progressRatio = (scrollY: number, scrollHeight: number, innerHeight: number): number => {
  const max = scrollHeight - innerHeight;
  return max > 0 ? Math.min(1, scrollY / max) : 0;
};
export const progressTransform = (ratio: number): string => "scaleX(" + ratio + ")";

export interface ProgressEnv {
  win: {
    innerHeight: number; scrollY: number;
    addEventListener(t: string, f: () => void, o?: unknown): void;
    removeEventListener(t: string, f: () => void, o?: unknown): void;
  };
  doc: { documentElement: { scrollHeight: number } };
  requestAnimationFrame(f: () => void): unknown;
}

/** Same wiring as v4: scroll (passive, one rAF per frame) + resize, initial update. Returns the teardown (v4 had none). */
export function mountScrollProgress(env: ProgressEnv, bar: { style: StyleLike }): () => void {
  let tick = false;
  const upd = () => {
    bar.style.transform = progressTransform(progressRatio(env.win.scrollY, env.doc.documentElement.scrollHeight, env.win.innerHeight));
    tick = false;
  };
  const onScroll = () => { if (!tick) { tick = true; env.requestAnimationFrame(upd); } };
  env.win.addEventListener("scroll", onScroll, { passive: true });
  env.win.addEventListener("resize", upd);
  upd();
  return () => { env.win.removeEventListener("scroll", onScroll, { passive: true }); env.win.removeEventListener("resize", upd); };
}
