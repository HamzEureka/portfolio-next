/**
 * Pure math for the testimonials "spotlight" (ported 1:1 from v4 index.html, the
 * TESTIMONIALS: HYBRID block). No DOM, no React: every function takes numbers and returns
 * the values the original wrote to `card.style` / used for scrolling. Parity with the original
 * code is verified in tests/spotlight.test.ts.
 */

export type Mode = "mobile" | "desktop";

/** Style values for one card; strings match what the original assigned. */
export interface CardStyle {
  transform: string;
  opacity: string;
  zIndex: number;
  filter: string; // "none" or "blur(Npx)"
}

/** Breakpoint (px) at/below which the mobile mode is used: `(max-width: 720px)`. */
export const MOBILE_MAX_WIDTH = 720;
export const MOBILE_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`;
/** Mobile autoplay interval (ms) and swipe threshold (px). */
export const MOBILE_AUTOPLAY_MS = 4500;
export const MOBILE_SWIPE_MIN_PX = 40;
export const MOBILE_RESUME_AFTER_DOT_MS = 3000;

// ---------- mobile ----------

/** Wrapped signed distance from card i to the active index (range -n/2..n/2). */
function wrapDistance(i: number, active: number, n: number): number {
  let d = i - active;
  if (d > n / 2) d -= n;
  if (d < -n / 2) d += n;
  return d;
}

export function mobileCardStyle(i: number, active: number, n: number): CardStyle {
  const d = wrapDistance(i, active, n);
  const ad = Math.abs(d);
  const x = -d * 200;
  const scale = 1 - Math.min(ad, 2) * 0.12;
  const opacity = ad > 2 ? 0 : Math.max(0, 1 - ad * 0.4);
  return {
    transform: `translate(-50%, -50%) translateX(${x.toFixed(1)}px) scale(${scale.toFixed(3)})`,
    opacity: opacity.toFixed(2),
    zIndex: Math.round(100 - ad * 20),
    filter: "none",
  };
}

/** Index of the dot to highlight for a (possibly fractional) active position. */
export function mobileActiveDot(active: number, n: number): number {
  return ((Math.round(active) % n) + n) % n;
}

export const mobileNext = (index: number, n: number): number => (index + 1) % n;

/** Result of a touch swipe: dx > 0 goes to the next index (as in v4), |dx| <= 40 changes nothing. */
export function mobileSwipe(index: number, dx: number, n: number): number {
  if (Math.abs(dx) > MOBILE_SWIPE_MIN_PX) return (index + (dx > 0 ? 1 : -1) + n) % n;
  return index;
}

// ---------- desktop ----------

/** Horizontal gap between cards: 260 when the window is <= 1000px wide, else 290. */
export const desktopGap = (innerWidth: number): number => (innerWidth <= 1000 ? 260 : 290);

/**
 * Fractional active position (0..n-1) from the section's scroll progress, or null when the
 * section is not taller than the viewport (the original does not render in that case).
 * `rectTop`/`rectHeight` come from section.getBoundingClientRect().
 */
export function desktopActiveFloat(rectTop: number, rectHeight: number, viewportH: number, n: number): number | null {
  const scrollable = rectHeight - viewportH;
  if (scrollable <= 0) return null;
  const progress = Math.max(0, Math.min(1, -rectTop / scrollable));
  const padded = Math.max(0, Math.min(1, (progress - 0.08) / 0.84));
  return padded * (n - 1);
}

export const desktopNearest = (activeFloat: number): number => Math.round(activeFloat);

export function desktopCardStyle(i: number, activeFloat: number, gap: number): CardStyle {
  const d = i - activeFloat;
  const ad = Math.abs(d);
  const x = -d * gap;
  const scale = 1 - Math.min(ad, 2) * 0.15;
  const opacity = ad > 2.5 ? 0 : Math.max(0, 1 - ad * 0.35);
  const blur = Math.min(ad, 2) * 3;
  const rotY = Math.max(-12, Math.min(12, -d * 6));
  return {
    transform:
      `translate(-50%, -50%) translateX(${x.toFixed(2)}px) ` +
      `scale(${scale.toFixed(3)}) rotateY(${rotY.toFixed(2)}deg)`,
    opacity: opacity.toFixed(3),
    zIndex: Math.round(100 - ad * 20),
    filter: blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : "none",
  };
}

/** window.scrollTo `top` for a dot click on desktop, or null when there is nothing to scroll. */
export function desktopScrollTarget(i: number, n: number, sectionTop: number, scrollable: number): number | null {
  if (scrollable <= 0) return null;
  return sectionTop + (0.08 + (n > 1 ? i / (n - 1) : 0) * 0.84) * scrollable;
}
