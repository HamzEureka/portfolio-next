// STATUS: UNVERIFIED (DeepSeek draft, reviewed by Claude; tsx --test + tsc passed in the cloud sandbox only, not yet on the owner's machine)
/**
 * W2: detonation (countdown + runExplosion orchestration), v4 site/index.html:2451-2483 and 2561-2593.
 *
 * QUIRKS (preserved from the original v4 code):
 * - `dataset.done` guards a second detonation; W2 sets it to "1" and never clears it (W7 reset does).
 * - Missing `.cat-countdown` is NOT null-checked. After setting `done` and hiding cta/bomb, the first tick throws
 *   a TypeError when assigning `textContent` (index.html:2457, 2465).
 * - Missing cta, bomb or flash are skipped silently (index.html:2455-2459, 2563-2568).
 * - The countdown "show" class is removed BEFORE the boom (index.html:2476-2478); "shake" is added after the
 *   flash restart and removed 500 ms later (index.html:2569, 2577).
 * - Tick frequencies use `tickFreqs[n] || 660` (index.html:2462, 2470).
 * - Timeline for a click at t=0: 3 at 0, 2 at 700, 1 at 1400, "show" removed + boom + flash + shake +
 *   explosion call at 2050, shake removed at 2550, reveal at 4250.
 * - If `explode()` returns false, the fallback is called only when non-null; with null nothing else happens
 *   (W3 is pending). The original always called its spawn* functions there.
 *
 * DEVIATIONS (intentional, no visible behaviour change):
 * - `dispose()` clears every pending timer scheduled by this detonation and is idempotent. The original never
 *   cleans up.
 * - After `dispose()`, `detonate()` is a no-op so that no timer can be created after unmount.
 */
import type { CreateDetonation } from "./contract";

// SOURCE: index.html:2462
const TICK_FREQS: Readonly<Record<number, number>> = { 3: 660, 2: 740, 1: 830 };
// SOURCE: index.html:2474
const TICK_DELAY_MS = 700;
// SOURCE: index.html:2476-2479
const EXPLOSION_DELAY_MS = 650;
// SOURCE: index.html:2575
const FALLBACK_SMOKE_DELAY_MS = 150;
// SOURCE: index.html:2577
const SHAKE_DURATION_MS = 500;
// SOURCE: index.html:2579-2592
const REVEAL_DELAY_MS = 2200;

export const createDetonation: CreateDetonation = (env) => {
  const { parts, timers, sounds, explode, explosionTarget, fallback, reveal } = env;
  const pending = new Set<number>();
  let disposed = false;

  const schedule = (fn: () => void, ms: number): void => {
    if (disposed) return;
    let id = 0;
    id = timers.setTimeout(() => {
      pending.delete(id);
      if (disposed) return;
      fn();
    }, ms);
    pending.add(id);
  };

  const detonate = (): void => {
    if (disposed) return;

    const cover = parts.cover;
    // SOURCE: index.html:2452-2453
    if (cover.dataset.done) return;
    cover.dataset.done = "1";

    // SOURCE: index.html:2455-2459
    if (parts.cta) parts.cta.style.opacity = "0";
    if (parts.bomb) parts.bomb.style.opacity = "0";

    // SOURCE: index.html:2461
    let n = 3;

    const runExplosion = (): void => {
      // SOURCE: index.html:2562
      sounds.playBoom();

      // SOURCE: index.html:2563-2568
      const flash = parts.flash;
      if (flash) {
        flash.classList.remove("active");
        void flash.offsetWidth;
        flash.classList.add("active");
      }

      // SOURCE: index.html:2569
      cover.classList.add("shake");

      // SOURCE: index.html:2571
      const used = explode(explosionTarget);

      // SOURCE: index.html:2572-2576
      if (!used) {
        const fb = fallback;
        if (fb) {
          fb.particles();
          fb.blackout();
          schedule(() => {
            fb.smoke();
          }, FALLBACK_SMOKE_DELAY_MS);
        }
      }

      // SOURCE: index.html:2577
      schedule(() => {
        cover.classList.remove("shake");
      }, SHAKE_DURATION_MS);

      // SOURCE: index.html:2579-2592 (the reveal itself is owned by W7)
      schedule(() => {
        reveal();
      }, REVEAL_DELAY_MS);
    };

    const tickStep = (): void => {
      // SOURCE: index.html:2457, 2465 - the original has no null check here; a missing countdown throws.
      const countdown = parts.countdown!;
      countdown.textContent = String(n);
      countdown.classList.add("show");
      countdown.classList.remove("pulse");
      void countdown.offsetWidth;
      countdown.classList.add("pulse");
      sounds.playTick(TICK_FREQS[n] || 660);

      // SOURCE: index.html:2472-2480
      if (n > 1) {
        n--;
        schedule(tickStep, TICK_DELAY_MS);
      } else {
        schedule(() => {
          countdown.classList.remove("show");
          runExplosion();
        }, EXPLOSION_DELAY_MS);
      }
    };

    // SOURCE: index.html:2482
    tickStep();
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (const id of pending) timers.clearTimeout(id);
    pending.clear();
  };

  return { detonate, dispose };
};
