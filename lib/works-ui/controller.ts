// STATUS: UNVERIFIED (Claude draft; M4/T6; checked against the fake world in the cloud sandbox only, never in a browser)
/**
 * T6: controller of ONE works category (v7). Framework-free; every browser capability is injected.
 *
 * Wires (all v4 behaviour kept, D21):
 *   click -> countdown 3-2-1 -> boom + flash + shake + explosion (lib/works/detonation.ts, sounds.ts, explosion.ts)
 *         -> 2200 ms later: `dispatch(reveal)` (the list opens in React state) + the v4 "fly-in" replay on the cards.
 *   scroll away (IntersectionObserver, threshold 0, v4 rule) -> EFFECT-ONLY reset (D22): `dispatch(reset)` and the v4 cleanup of
 *   done/cta/bomb/countdown. It never hides the list, never shows the cover, never changes `open`.
 *   Q1 kept: a reset in the middle of a run does not cancel the pending timers; the list still opens 2200 ms after the click.
 *
 * What React owns (NOT done here): which of cover/list is mounted and visible (`categoryReducer` state), and the Open/Close buttons.
 *
 * DEVIATIONS (intentional):
 * - `dispose()` clears every timer/frame/observer/audio context of this controller (React unmount; StrictMode mounts twice). Idempotent.
 * - `reveal` does not hide the cover or show the list through DOM writes (v4 revealProjects): React state does it.
 * - Reset skips v4's "hide list / show cover" half (violates D22); the cover is always visible until the first reveal anyway.
 * - A cover without `.cat-countdown` is not detonated at all (v4 set `done` and then threw a TypeError on the first tick).
 * - One observer per category (v4 used one for all sections).
 */
import type { CategoryAction } from "../works";
import { shouldReset } from "../works";
import { createDetonation } from "../works/detonation";
import type {
  CoverParts, ExplosionFn, ExplosionTarget, IntersectionObserverFactory, ProjectsLike, Sounds, TimerApi,
} from "../works/contract";

export interface ControllerEnv {
  /** The `.category-section` element: the IntersectionObserver target. */
  section: object;
  /** The cover pieces; null when the category has no cover mounted (already opened once). */
  parts: CoverParts | null;
  timers: TimerApi;
  sounds: Pick<Sounds, "playTick" | "playBoom" | "dispose">;
  explosion: { explode: ExplosionFn; dispose(): void };
  explosionTarget: ExplosionTarget;
  createObserver: IntersectionObserverFactory;
  /** Sends an action to the category reducer (React `dispatch`). */
  dispatch: (action: CategoryAction) => void;
}

export interface WorksController {
  /** Click on the cover. Ignored while `done`, after dispose, without a cover or without a countdown element. */
  detonate(): void;
  dispose(): void;
}

// SOURCE: index.html:2585-2590 (the card loop of the 2200 ms reveal timer; the display toggles are React's job)
export function replayFlyIn(projects: ProjectsLike | null): void {
  if (!projects) return;
  projects.cards().forEach((card, i) => {
    card.classList.remove("fly-in");
    void card.offsetWidth;
    card.style.animationDelay = (i * 0.08) + "s";
    card.classList.add("fly-in");
  });
}

/** v4 resetCategory (index.html:2604-2614) WITHOUT its first two lines (hide list, show cover): D22. */
export function resetEffect(parts: CoverParts): void {
  parts.cover.dataset.done = "";
  if (parts.cta) parts.cta.style.opacity = "";
  if (parts.bomb) parts.bomb.style.opacity = "";
  if (parts.countdown) parts.countdown.classList.remove("show", "pulse");
}

export function mountWorksController(env: ControllerEnv): WorksController {
  const { parts, dispatch } = env;
  let disposed = false;

  const detonation = parts
    ? createDetonation({
        parts,
        timers: env.timers,
        sounds: env.sounds,
        explode: (target) => {
          dispatch({ type: "boom" });
          return env.explosion.explode(target);
        },
        explosionTarget: env.explosionTarget,
        fallback: null,
        reveal: () => {
          dispatch({ type: "reveal" });
          replayFlyIn(parts.projects);
        },
      })
    : null;

  const observer =
    parts === null
      ? null
      : env.createObserver((entries) => {
          if (disposed) return;
          entries.forEach((entry) => {
            if (entry.target !== env.section) return;
            // SOURCE: index.html:2623-2626 (done && !intersecting && top > 0)
            const done = Boolean(parts.cover.dataset.done);
            if (!shouldReset({ done, isIntersecting: entry.isIntersecting, top: entry.boundingClientRect.top })) return;
            resetEffect(parts);
            dispatch({ type: "reset" });
          });
        }, { threshold: 0 });
  observer?.observe(env.section);

  const detonate = (): void => {
    if (disposed || !parts || !detonation || !parts.countdown) return;
    if (parts.cover.dataset.done) return; // v4 guard; also keeps the reducer out of a second run
    dispatch({ type: "detonate" });
    detonation.detonate();
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    detonation?.dispose();
    observer?.disconnect();
    env.explosion.dispose();
    env.sounds.dispose();
  };

  return { detonate, dispose };
}
