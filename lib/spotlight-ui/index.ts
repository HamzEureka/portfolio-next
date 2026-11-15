// STATUS: UNVERIFIED (DeepSeek draft)
/**
 * QUIRKS (preserved from the original v4 code):
 * - A requestAnimationFrame scheduled by an earlier scroll SURVIVES a mode switch. If it fires
 *   after the switch, it OVERWRITES the mobile render with desktop styles (original does the same).
 * - `lastNearest` inside the desktop controller is NOT reset by a mode switch. On re-entry into
 *   desktop mode, render() therefore SKIPS setActiveDot when nearest === lastNearest.
 * - `ticking` (dTicking) is also NOT reset by a mode switch; the pending RAF clears it when it fires.
 * - The mobile controller attaches its touch listeners at mountSpotlight time, BEFORE applyMode()
 *   runs. So touchstart/touchend/touchcancel are always registered, even while in desktop mode.
 * - The original's window "resize" listener is registered once at mount and guarded by
 *   `if (mode === "desktop") renderDesktop()`. The port adds/removes it via desktop.start()/stop();
 *   observable behaviour is identical, live-listener counts differ (see allow-deviation note).
 * - Dots are created BEFORE ctx/controllers exist. The click handler captures onDotClick, which
 *   reads isMobile() live, so mode switches route the click correctly.
 * - The original has NO teardown; the returned Unmount is a new addition (per task deviations).
 */
import { MOBILE_QUERY } from "../spotlight";
import type { DotEl, MqLike, MountSpotlight, Unmount } from "./contract";
import { createDesktop } from "./desktop";
import { createMobile } from "./mobile";

export const mountSpotlight: MountSpotlight = (env) => {
  const N = env.cards.length;
  if (N === 0) return () => {};
  if (env.win.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};

  // Forward-declared: dots capture this; it is wired after the controllers exist.
  let onDotClick: (i: number) => void = () => {};

  const dots: DotEl[] = [];
  for (let i = 0; i < N; i++) {
    const dot = env.dots.create();
    dot.type = "button";
    dot.className = "spotlight-dot";
    dot.setAttribute("aria-label", env.dotLabel(i));
    dot.addEventListener("click", () => onDotClick(i));
    env.dots.add(dot);
    dots.push(dot);
  }

  const setActiveDot = (i: number): void => {
    dots.forEach((d, k) => d.classList.toggle("active", k === i));
  };

  const ctx = {
    win: env.win,
    section: env.section,
    cards: env.cards,
    setActiveDot,
  };
  const desktop = createDesktop(ctx);
  const mobile = createMobile({ ...ctx, touchTarget: env.touchTarget });

  const mq: MqLike = env.win.matchMedia(MOBILE_QUERY);
  const isMobile = (): boolean => mq.matches;
  let mode: "mobile" | "desktop" | null = null;

  const applyMode = (): void => {
    const m: "mobile" | "desktop" = isMobile() ? "mobile" : "desktop";
    if (m === mode) return;
    if (mode === "desktop") desktop.stop();
    if (mode === "mobile") mobile.stop();
    mode = m;
    if (m === "mobile") mobile.start();
    else desktop.start();
  };

  onDotClick = (i: number): void => {
    if (isMobile()) mobile.goTo(i);
    else desktop.goTo(i);
  };

  mq.addEventListener("change", applyMode);
  applyMode();

  // DEVIATION: the returned Unmount is new (the original has none).
  return (): void => {
    mq.removeEventListener("change", applyMode);
    if (mode === "desktop") desktop.stop();
    if (mode === "mobile") mobile.stop();
    mobile.dispose();
    desktop.dispose();
    for (const d of dots) env.dots.remove(d);
    dots.length = 0;
    mode = null;
  };
};
