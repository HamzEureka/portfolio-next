// STATUS: UNVERIFIED (DeepSeek draft)
/**
 * QUIRKS (preserved from the original v4 code):
 * - startAuto() calls stopAuto() first; calling it twice is idempotent.
 * - goTo(i) does NOT clear a still-pending resume timeout; the earlier timeout still fires.
 * - start() resets `index` to 0 but does NOT reset `paused`.
 * - stop() resets transform/opacity/zIndex but NOT filter (the original leaves it).
 * - Touch listeners are attached at creation, not gated by mode (original attaches at mount).
 * - touchstart/touchend read touches[0]/changedTouches[0] with no guard.
 * - Autoplay interval keeps firing while paused; only `next()` is gated by `paused`.
 * - Card styles use a single ±N wrap in mobileCardStyle; the active dot uses full mod in
 *   mobileActiveDot — the two are inconsistent when |i - active| > N (as in the original).
 * - Earlier goTo timeouts still fire (as in the original). DEVIATION: all of them are now remembered
 *   so dispose() clears every one (the original never tears down).
 */
import {
  MOBILE_AUTOPLAY_MS, MOBILE_RESUME_AFTER_DOT_MS, MOBILE_SWIPE_MIN_PX,
  mobileActiveDot, mobileCardStyle, mobileNext, mobileSwipe,
} from "../spotlight";
import type { CreateMobile, TouchEventLike } from "./contract";

export const createMobile: CreateMobile = (ctx) => {
  const { win, cards, setActiveDot, touchTarget } = ctx;
  const N = cards.length;

  let index = 0;
  let paused = false;
  let timer: number | null = null;
  let touchStartX = 0;
  const resumeIds = new Set<number>();

  const render = (active: number): void => {
    cards.forEach((card, i) => {
      const s = mobileCardStyle(i, active, N);
      card.style.transform = s.transform;
      card.style.opacity = s.opacity;
      card.style.zIndex = s.zIndex;
      card.style.filter = s.filter;
    });
    setActiveDot(mobileActiveDot(active, N));
  };

  const next = (): void => {
    index = mobileNext(index, N);
    render(index);
  };

  const stopAuto = (): void => {
    if (timer !== null) {
      win.clearInterval(timer);
      timer = null;
    }
  };

  const startAuto = (): void => {
    stopAuto();
    timer = win.setInterval(() => { if (!paused) next(); }, MOBILE_AUTOPLAY_MS);
  };

  const onTouchStart = (e: TouchEventLike): void => {
    // DEVIATION: guard against an empty list (synthetic/interrupted events); the original would throw.
    const p = e.touches[0];
    if (p) touchStartX = p.clientX;
    paused = true;
  };
  const onTouchEnd = (e: TouchEventLike): void => {
    const p = e.changedTouches[0];
    if (p) {
      const dx = p.clientX - touchStartX;
      if (Math.abs(dx) > MOBILE_SWIPE_MIN_PX) {
        index = mobileSwipe(index, dx, N);
        render(index);
      }
    }
    paused = false; // always resume, so a malformed touchend can never leave autoplay stuck
  };
  const onTouchCancel = (): void => {
    paused = false;
  };

  touchTarget.addEventListener("touchstart", onTouchStart, { passive: true });
  touchTarget.addEventListener("touchend", onTouchEnd, { passive: true });
  touchTarget.addEventListener("touchcancel", onTouchCancel, { passive: true });

  const start = (): void => {
    index = 0;
    render(0);
    startAuto();
  };

  const stop = (): void => {
    stopAuto();
    cards.forEach((card) => {
      card.style.transform = "";
      card.style.opacity = "";
      card.style.zIndex = "";
    });
  };

  const goTo = (i: number): void => {
    index = i;
    render(index);
    paused = true;
    // Behaviour unchanged (earlier timeouts still fire, as in the original); we only REMEMBER all of them.
    const id = win.setTimeout(() => { resumeIds.delete(id); paused = false; }, MOBILE_RESUME_AFTER_DOT_MS);
    resumeIds.add(id);
  };

  // DEVIATION: dispose() is new (the original never removes listeners).
  const dispose = (): void => {
    touchTarget.removeEventListener("touchstart", onTouchStart);
    touchTarget.removeEventListener("touchend", onTouchEnd);
    touchTarget.removeEventListener("touchcancel", onTouchCancel);
    stopAuto();
    resumeIds.forEach((id) => win.clearTimeout(id));
    resumeIds.clear();
  };

  return { start, stop, goTo, dispose };
};
