/**
 * Contract for the testimonials "spotlight" controllers (v6b-v6e). TYPES ONLY.
 *
 * Every browser capability the original v4 code used (document, window, timers, rAF,
 * matchMedia, touch events) is INJECTED through these interfaces, so the same code runs in a
 * browser (real objects) and in tests (fake objects from tests/helpers/spotlight-harness.ts).
 *
 * - Original behaviour: tests/fixtures/spotlight-original.js (verbatim copy of the v4 block).
 * - Pure math/constants: lib/spotlight.ts (v6a). Reuse it, never re-implement it.
 *
 * Files and the exports they MUST provide:
 *   lib/spotlight-ui/desktop.ts -> export const createDesktop: CreateDesktop
 *   lib/spotlight-ui/mobile.ts  -> export const createMobile:  CreateMobile
 *   lib/spotlight-ui/index.ts   -> export const mountSpotlight: MountSpotlight
 */

/** Inline-style fields the original writes on each card (DOM coerces numbers to strings). */
export interface StyleLike {
  transform: string;
  opacity: string;
  zIndex: string | number;
  filter: string;
}
export interface CardEl {
  style: StyleLike;
}

export interface RectLike {
  top: number;
  height: number;
}
/** The `#testimonialsScroll` section. */
export interface SectionLike {
  getBoundingClientRect(): RectLike;
}

export interface TouchPointLike {
  clientX: number;
}
export interface TouchEventLike {
  touches: ArrayLike<TouchPointLike>;
  changedTouches: ArrayLike<TouchPointLike>;
}
export type TouchEventName = "touchstart" | "touchend" | "touchcancel";
/** `track.parentElement` in the original: where the touch listeners are attached. */
export interface TouchTargetLike {
  addEventListener(type: TouchEventName, fn: (e: TouchEventLike) => void, opts?: { passive?: boolean }): void;
  removeEventListener(type: TouchEventName, fn: (e: TouchEventLike) => void): void;
}

export interface MqLike {
  readonly matches: boolean;
  addEventListener(type: "change", fn: () => void): void;
  removeEventListener(type: "change", fn: () => void): void;
}

/** The subset of `window` the original uses (timers and rAF are included on purpose). */
export interface WinLike {
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly scrollY: number;
  matchMedia(query: string): MqLike;
  addEventListener(type: "scroll" | "resize", fn: () => void, opts?: { passive?: boolean }): void;
  removeEventListener(type: "scroll" | "resize", fn: () => void): void;
  scrollTo(opts: { top: number; behavior: "smooth" }): void;
  requestAnimationFrame(fn: () => void): number;
  cancelAnimationFrame(id: number): void;
  setInterval(fn: () => void, ms: number): number;
  clearInterval(id: number): void;
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

/** A navigation dot (a <button> in the browser). */
export interface DotEl {
  type: string;
  className: string;
  setAttribute(name: string, value: string): void;
  addEventListener(type: "click", fn: () => void): void;
  readonly classList: { toggle(token: string, force?: boolean): unknown };
}
/** Where dots live (`#spotlightDots`). The caller implements these three callbacks. */
export interface DotsHost {
  create(): DotEl;
  add(dot: DotEl): void;
  remove(dot: DotEl): void;
}

/** What a mode controller (desktop or mobile) needs. */
export interface ModeCtx {
  win: WinLike;
  section: SectionLike;
  cards: readonly CardEl[];
  /** Highlights dot `i` (toggles class "active" on every dot, like the original setActiveDot). */
  setActiveDot(i: number): void;
}
export interface MobileCtx extends ModeCtx {
  touchTarget: TouchTargetLike;
}

/**
 * Desktop (scroll-driven) controller.
 * - start(): original applyMode->desktop: add the passive scroll listener and the resize listener,
 *   then render once.
 * - stop(): original cleanupDesktop: remove both listeners and reset transform/opacity/filter/zIndex
 *   of every card to "".
 * - goTo(i): original desktopGoTo (smooth scrollTo; does nothing when the section is not scrollable).
 * - dispose(): FINAL teardown only (never on a mode switch, where the original lets a queued frame run):
 *   cancel the queued animation frame, if any.
 * Instance state (`lastNearest`, the rAF flag) lives in the controller and is NOT reset by start().
 */
export interface DesktopSpotlight {
  start(): void;
  stop(): void;
  goTo(i: number): void;
  dispose(): void;
}

/**
 * Mobile (autoplay + swipe) controller.
 * - Created once: the touch listeners are attached IMMEDIATELY at creation, not in start()
 *   (the original attaches them at mount and never gates them by mode).
 * - start(): original applyMode->mobile: index = 0, render(0), start autoplay.
 * - stop(): original cleanupMobile: stop autoplay and reset transform/opacity/zIndex to ""
 *   (NOT filter: the original does not touch it).
 * - goTo(i): original onDotClick mobile branch (set index, render, pause, resume after 3000 ms).
 * - dispose(): remove the touch listeners, stop autoplay, clear EVERY pending resume timeout.
 */
export interface MobileSpotlight {
  start(): void;
  stop(): void;
  goTo(i: number): void;
  dispose(): void;
}

export interface SpotlightEnv {
  win: WinLike;
  section: SectionLike;
  cards: readonly CardEl[];
  touchTarget: TouchTargetLike;
  dots: DotsHost;
  /** aria-label of dot `i` (zero-based). The original used "الاقتباس رقم " + (i + 1). */
  dotLabel(i: number): string;
}

/** Call to tear everything down (React effect cleanup). Must be safe to call more than once. */
export type Unmount = () => void;

export type CreateDesktop = (ctx: ModeCtx) => DesktopSpotlight;
export type CreateMobile = (ctx: MobileCtx) => MobileSpotlight;
export type MountSpotlight = (env: SpotlightEnv) => Unmount;
