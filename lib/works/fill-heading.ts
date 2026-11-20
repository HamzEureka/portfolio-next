// STATUS: UNVERIFIED (Claude draft; tsx --test + tsc passed in the cloud sandbox only, not yet on the owner's machine)
/**
 * W5: the PORTFOLIO heading that fills from left to right while the page scrolls (v4 site/index.html:2631-2659).
 *
 * QUIRKS (preserved from the original v4 code):
 * - window.innerHeight 0 makes `start === end`, so progress is (0 - top) / 0: NaN when top is 0 (NaN survives the
 *   clamp and is written as "inset(0 NaN% 0 0)"), otherwise +-Infinity which the clamp turns into 1 or 0.
 * - The scroll listener is registered with { passive: true }; the resize listener WITHOUT options.
 * - `ticking` is cleared at the END of an update and only by an update: a scroll/resize event while a frame is
 *   already queued is ignored.
 * - The first update at mount is synchronous (not through requestAnimationFrame).
 * - The clip-path uses default Number formatting, no rounding (e.g. "inset(0 66.66666666666667% 0 0)").
 * - Under prefers-reduced-motion the original does nothing at all (the CSS then shows the filled heading).
 *
 * DEVIATIONS (intentional, no visible behaviour change):
 * - mountFillHeading returns an Unmount that removes both listeners and cancels a queued frame. The original
 *   never cleans up.
 * - `fill` (.sfh-fill) is required by the env type. The original throws a TypeError at mount when it is missing,
 *   which aborts the rest of its script; the caller simply must not mount without it.
 * - An absent heading is the caller's concern (the original skipped the whole block): do not call
 *   mountFillHeading in that case.
 */
import type { MountFillHeading } from "./contract";

// SOURCE: index.html:2640
/** Viewport fraction (from the top) where the fill starts. */
export const FILL_START = 0.9;
// SOURCE: index.html:2641
/** Viewport fraction (from the top) where the fill is complete. */
export const FILL_END = 0.25;

// SOURCE: index.html:2640-2643
/** 0..1 progress of the fill for a heading whose top edge is at `top` in a viewport `vh` tall. */
export function fillProgress(top: number, vh: number): number {
  const start = vh * FILL_START;
  const end = vh * FILL_END;
  const progress = (start - top) / (start - end);
  return Math.max(0, Math.min(1, progress));
}

// SOURCE: index.html:2644-2645
/** The `clip-path` value that reveals `progress` (0..1) of the filled text from the start edge. */
export function fillClipPath(progress: number): string {
  const inset = 100 - progress * 100;
  return `inset(0 ${inset}% 0 0)`;
}

export const mountFillHeading: MountFillHeading = (env) => {
  const { win, heading, fill, reduceMotion } = env;
  // SOURCE: index.html:2633
  if (reduceMotion) return () => {};

  let ticking = false;
  let frame: number | null = null;
  let mounted = true;

  // SOURCE: index.html:2637-2647
  const update = (): void => {
    frame = null;
    const rect = heading.getBoundingClientRect();
    fill.style.clipPath = fillClipPath(fillProgress(rect.top, win.innerHeight));
    ticking = false;
  };

  // SOURCE: index.html:2649-2654
  const onScroll = (): void => {
    if (!ticking) {
      frame = win.requestAnimationFrame(update);
      ticking = true;
    }
  };

  // SOURCE: index.html:2656-2658
  win.addEventListener("scroll", onScroll, { passive: true });
  win.addEventListener("resize", onScroll);
  update();

  return () => {
    if (!mounted) return;
    mounted = false;
    win.removeEventListener("scroll", onScroll);
    win.removeEventListener("resize", onScroll);
    if (frame !== null) {
      win.cancelAnimationFrame(frame);
      frame = null;
    }
  };
};
