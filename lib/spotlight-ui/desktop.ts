// STATUS: UNVERIFIED (DeepSeek draft)
/**
 * QUIRKS (preserved from the original v4 code):
 * - `ticking` (original `dTicking`) is reset to false at the START of render, not the end.
 * - `lastNearest` is NOT reset by start()/stop(); it persists across mode cycles.
 * - goTo with n=1 calls win.scrollTo with top = NaN (0/0 from i/(N-1)); kept as-is.
 * - render() writes nothing (not even cleanup) when the section is not taller than the viewport.
 * - When activeFloat is null, setActiveDot is NOT called; the previously active dot stays.
 */
import {
  desktopActiveFloat, desktopCardStyle, desktopGap, desktopNearest, desktopScrollTarget,
} from "../spotlight";
import type { CreateDesktop } from "./contract";

export const createDesktop: CreateDesktop = (ctx) => {
  const { win, section, cards, setActiveDot } = ctx;
  const N = cards.length;
  let ticking = false;
  let lastNearest = -1;
  let rafId: number | null = null;

  const render = (): void => {
    ticking = false;
    rafId = null;
    const rect = section.getBoundingClientRect();
    const activeFloat = desktopActiveFloat(rect.top, rect.height, win.innerHeight, N);
    if (activeFloat === null) return;
    const nearest = desktopNearest(activeFloat);
    if (nearest !== lastNearest) {
      lastNearest = nearest;
      setActiveDot(nearest);
    }
    const gap = desktopGap(win.innerWidth);
    cards.forEach((card, i) => {
      const s = desktopCardStyle(i, activeFloat, gap);
      card.style.transform = s.transform;
      card.style.opacity = s.opacity;
      card.style.filter = s.filter;
      card.style.zIndex = s.zIndex;
    });
  };

  const onScroll = (): void => {
    if (!ticking) {
      rafId = win.requestAnimationFrame(render);
      ticking = true;
    }
  };

  const onResize = (): void => {
    render();
  };

  const start = (): void => {
    // DEVIATION: listeners added in start() and removed in stop(); the original adds the
    // resize listener once at mount and guards it by mode.
    win.addEventListener("scroll", onScroll, { passive: true });
    win.addEventListener("resize", onResize);
    render();
  };

  const stop = (): void => {
    win.removeEventListener("scroll", onScroll);
    win.removeEventListener("resize", onResize);
    cards.forEach((card) => {
      card.style.transform = "";
      card.style.opacity = "";
      card.style.filter = "";
      card.style.zIndex = "";
    });
  };

  const goTo = (i: number): void => {
    const rect = section.getBoundingClientRect();
    const target = desktopScrollTarget(i, N, win.scrollY + rect.top, rect.height - win.innerHeight);
    if (target === null) return;
    win.scrollTo({ top: target, behavior: "smooth" });
  };

  // DEVIATION: dispose() is new. Final unmount only: a queued frame must not write styles after
  // React removed the component. A mode switch still calls stop(), which keeps the original quirk.
  const dispose = (): void => {
    if (rafId !== null) {
      win.cancelAnimationFrame(rafId);
      rafId = null;
      ticking = false;
    }
  };

  return { start, stop, goTo, dispose };
};
