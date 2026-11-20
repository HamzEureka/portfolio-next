// STATUS: UNVERIFIED (DeepSeek draft, reviewed by Claude; tsx --test + tsc passed in the cloud sandbox only, not yet on the owner's machine)
/**
 * W1: only the focused stack card plays (v4 site/index.html:2301-2356).
 *
 * QUIRKS preserved:
 * - `lastFocused` caching (index.html:2323-2324): a second update with the same focused index does nothing at all.
 * - `muted = true` is written before `play()` on every focus change (index.html:2330-2331); play() rejections are
 *   swallowed by `.catch(() => {})` so a blocked autoplay never throws.
 * - `card.video()` is evaluated at every update (index.html:2327) — a video that appears later is picked up.
 * - The safety net (index.html:2350-2355) pauses every OTHER non-paused video when any video fires "play".
 * - Scroll/resize while a frame is already queued are ignored (ticking guard, index.html:2338-2343).
 * - The first update runs from a 100 ms timer even if the page never scrolls (index.html:2347).
 * - With zero `.stack-card` the original returns before registering anything (index.html:2304).
 *
 * DEVIATIONS (intentional, no behaviour change before unmount):
 * - mountPlayback returns an Unmount that removes both window listeners, clears the 100 ms timer, cancels a
 *   queued frame and removes every "play" listener it added; idempotent. The original never cleans up.
 * - A `mounted` guard in update() prevents a stale timer/frame from running after unmount (the original has
 *   no unmount at all).
 */
import type { MountPlayback, VideoLike } from "./contract";
import { focusedIndex } from "./focus";

// SOURCE: index.html:2302-2356
export const mountPlayback: MountPlayback = (env) => {
  const { win, cards, allVideos } = env;

  // SOURCE: index.html:2304
  if (cards.length === 0) return () => {};

  // SOURCE: index.html:2307-2308
  let ticking = false;
  let lastFocused = -1;

  let frame: number | null = null;
  let timer: number | null = null;
  let mounted = true;

  // SOURCE: index.html:2320-2336
  const update = (): void => {
    if (!mounted) return;
    ticking = false;
    const focused = focusedIndex(cards.length, (i) => cards[i].getBoundingClientRect());
    if (focused === lastFocused) return;
    lastFocused = focused;

    cards.forEach((card, i) => {
      const video = card.video();
      if (!video) return;
      if (i === focused) {
        video.muted = true;
        video.play().catch(() => {});
      } else if (!video.paused) {
        video.pause();
      }
    });
  };

  // SOURCE: index.html:2338-2343
  const onScroll = (): void => {
    if (!ticking) {
      frame = win.requestAnimationFrame(update);
      ticking = true;
    }
  };

  // SOURCE: index.html:2345-2347
  win.addEventListener("scroll", onScroll, { passive: true });
  win.addEventListener("resize", onScroll);
  timer = win.setTimeout(update, 100);

  // SOURCE: index.html:2349-2355
  const playListeners: Array<{ video: VideoLike; handler: () => void }> = [];
  for (const video of allVideos) {
    const handler = (): void => {
      for (const v of allVideos) {
        if (v !== video && !v.paused) v.pause();
      }
    };
    video.addEventListener("play", handler);
    playListeners.push({ video, handler });
  }

  return () => {
    if (!mounted) return;
    mounted = false;
    win.removeEventListener("scroll", onScroll);
    win.removeEventListener("resize", onScroll);
    if (timer !== null) {
      win.clearTimeout(timer);
      timer = null;
    }
    if (frame !== null) {
      win.cancelAnimationFrame(frame);
      frame = null;
    }
    for (const { video, handler } of playListeners) {
      video.removeEventListener("play", handler);
    }
    playListeners.length = 0;
  };
};
