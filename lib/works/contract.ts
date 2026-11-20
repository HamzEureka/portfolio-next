// STATUS: UNVERIFIED (Claude draft; types only; typechecked in the cloud sandbox, not yet on the owner's machine)
/**
 * Contract for the works-section controllers (v7). TYPES ONLY.
 *
 * Every browser capability the original v4 code used (document, window, timers, rAF, Audio, observers,
 * element reads/writes) is INJECTED through these interfaces, so the same code runs in a browser (real
 * objects, adapted by the React component later) and in tests (fake objects from
 * tests/helpers/works-harness.ts).
 *
 * Original behaviour lives in tests/fixtures/works-original-*.js (verbatim copies of v4 blocks).
 *
 * Task -> files that MUST be provided (names fixed here; all new files, nothing existing is modified):
 *   W5  lib/works/fill-heading.ts     -> fillProgress, fillClipPath, mountFillHeading        (index.html:2631-2659)
 *   W1  lib/works/focus.ts            -> focusedIndex (pure)                                  (index.html:2301-2356)
 *       lib/works/playback.ts         -> mountPlayback                                        (index.html:2301-2356)
 *   W7  lib/works/category-reveal.ts  -> revealProjects, resetCategory, mountSectionReset     (index.html:2579-2592, 2604-2629)
 *   W2  lib/works/detonation.ts       -> createDetonation (countdown AND runExplosion)        (index.html:2451-2483, 2561-2593)
 *   W4  lib/works/sounds.ts           -> createSounds                                         (index.html:2359-2407)
 *   W6  PROVISIONAL, starts after decision W0 (which explosion version). Only the call signature
 *       ExplosionFn is fixed here because both v4 versions share it.
 *   W3  PENDING a decision (the DOM fallback is unreachable while `.explosion-3d` exists in the markup).
 *       Only the optional `FallbackEffects` hook is declared so W2 does not need to change later.
 *
 * Ownership seams worth knowing:
 *   - `runExplosion` (index.html:2561-2593) belongs to W2 (it orchestrates sound, flash, shake, the
 *     explosion call and the reveal timer). It calls W4 (`sounds`), W6 (`explode`), W3 (`fallback`)
 *     and W7 (`reveal`) ONLY through DetonationEnv.
 *   - The click binding of the cover (index.html:2616-2618) is the caller's job (React onClick calls
 *     `Detonation.detonate`). The flag `cover.dataset.done` is shared by W2 (sets it) and W7 (reads and
 *     clears it).
 */

// ---------- shared primitives ----------

/** Call to tear everything down (React effect cleanup). Must be safe to call more than once. */
export type Unmount = () => void;

export interface TimerApi {
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
}
export interface FrameApi {
  requestAnimationFrame(fn: (now: number) => void): number;
  cancelAnimationFrame(id: number): void;
}
export interface ListenerOpts {
  passive?: boolean;
}
/** The subset of `window` used by the scroll-driven controllers (W1, W5). */
export interface ScrollWin extends TimerApi, FrameApi {
  readonly innerHeight: number;
  addEventListener(type: "scroll" | "resize", fn: () => void, opts?: ListenerOpts): void;
  removeEventListener(type: "scroll" | "resize", fn: () => void): void;
}
export interface ClassListLike {
  add(...tokens: string[]): void;
  remove(...tokens: string[]): void;
}
export interface RectLike {
  readonly top: number;
  readonly bottom: number;
}

// ---------- W5: fill heading ----------

/**
 * - mount: if `reduceMotion` nothing happens at all (no listeners, no write).
 *   Otherwise: add the passive scroll listener and the (option-less) resize listener, then update once.
 * - the original throws a TypeError at mount when `.sfh-fill` is missing; here `fill` is required by type.
 *   An absent heading means "do not mount" (the original skipped the whole block).
 */
export interface FillHeadingEnv {
  win: ScrollWin;
  heading: { getBoundingClientRect(): { readonly top: number } };
  fill: { style: { clipPath: string } };
  reduceMotion: boolean;
}
export type MountFillHeading = (env: FillHeadingEnv) => Unmount;

// ---------- W1: only the focused stack card plays ----------

export interface VideoLike {
  muted: boolean;
  readonly paused: boolean;
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: "play", fn: () => void): void;
  removeEventListener(type: "play", fn: () => void): void;
}
export interface StackCardLike {
  getBoundingClientRect(): RectLike;
  /** `card.querySelector('video')`, evaluated at every update like the original. */
  video(): VideoLike | null;
}
/**
 * - `cards`: `.stack-card` elements, in DOM order. With zero cards the original returns early and
 *   registers NOTHING (not even the one-play-at-a-time safety net); the port must do the same.
 * - `allVideos`: every `<video>` of the page, resolved once at mount (the safety net listens to them).
 */
export interface PlaybackEnv {
  win: ScrollWin;
  cards: readonly StackCardLike[];
  allVideos: readonly VideoLike[];
}
export type MountPlayback = (env: PlaybackEnv) => Unmount;

// ---------- cover / category elements (W2, W7) ----------

export interface CoverLike {
  style: { display: string };
  /** `dataset.done`: "1" while the category is detonated/open, "" after a reset (falsy both before and after). */
  dataset: { done?: string };
  /** Receives "shake". */
  readonly classList: ClassListLike;
}
export interface OpacityEl {
  style: { opacity: string };
}
export interface CountdownLike {
  textContent: string | null;
  /** Receives "show" and "pulse". */
  readonly classList: ClassListLike;
  /** Read (and discarded) to force a reflow between removing and re-adding "pulse". */
  readonly offsetWidth: number;
}
export interface FlashLike {
  /** Receives "active". */
  readonly classList: ClassListLike;
  readonly offsetWidth: number;
}
export interface RevealCardLike {
  /** Receives "fly-in". */
  readonly classList: ClassListLike;
  readonly style: { animationDelay: string };
  readonly offsetWidth: number;
}
export interface ProjectsLike {
  style: { display: string };
  /** `projList.querySelectorAll('.stack-card')`, evaluated at reveal time like the original. */
  cards(): readonly RevealCardLike[];
}
/** Everything the original reaches from one `.category-cover` (resolved by the caller, null when absent). */
export interface CoverParts {
  cover: CoverLike;
  cta: OpacityEl | null;
  bomb: OpacityEl | null;
  /** Required by W2 in practice: the original has no null check (TypeError on click). W7's reset does check. */
  countdown: CountdownLike | null;
  flash: FlashLike | null;
  /** `.category-projects[data-cat=...]` of this cover. */
  projects: ProjectsLike | null;
}

// ---------- W7: reveal and reset ----------

export interface IntersectionEntryLike {
  readonly target: object;
  readonly isIntersecting: boolean;
  readonly boundingClientRect: { readonly top: number };
}
export interface IntersectionObserverLike {
  observe(target: object): void;
  disconnect(): void;
}
export type IntersectionObserverFactory = (
  callback: (entries: readonly IntersectionEntryLike[]) => void,
  init: { threshold: number },
) => IntersectionObserverLike;

/** One `.category-section`. `parts` = `section.querySelector('.category-cover')` resolved (null when absent). */
export interface CategorySection {
  target: object;
  parts: CoverParts | null;
}
export interface SectionResetEnv {
  sections: readonly CategorySection[];
  createObserver: IntersectionObserverFactory;
}
/**
 * - revealProjects(parts): the body of the 2200 ms timer callback of `runExplosion` (hides the cover, shows the
 *   projects, replays "fly-in" on every card). It runs only if called; the timer itself belongs to W2.
 * - resetCategory(parts): original `resetCategory`.
 * - mountSectionReset(env): creates ONE observer (threshold 0) and observes every section, in order.
 *   Returns an Unmount that disconnects it (DEVIATION: the original never disconnects).
 */
export type RevealProjects = (parts: CoverParts) => void;
export type ResetCategory = (parts: CoverParts) => void;
export type MountSectionReset = (env: SectionResetEnv) => Unmount;

// ---------- W4: sounds ----------

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
}
export interface AudioNodeLike {
  /** Returns `dest`, so the original's chained `a.connect(b).connect(c)` works. */
  connect(dest: AudioNodeLike): AudioNodeLike;
}
export interface OscillatorLike extends AudioNodeLike {
  type: string;
  readonly frequency: AudioParamLike;
  start(): void;
  stop(when?: number): void;
}
export interface GainLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}
export interface BiquadLike extends AudioNodeLike {
  type: string;
  readonly frequency: AudioParamLike;
}
export interface AudioBufferLike {
  getChannelData(channel: number): Float32Array;
}
export interface BufferSourceLike extends AudioNodeLike {
  buffer: AudioBufferLike | null;
  start(): void;
}
export interface AudioContextLike {
  readonly state: string;
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly destination: AudioNodeLike;
  resume(): unknown;
  close(): unknown;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  createBiquadFilter(): BiquadLike;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBufferLike;
  createBufferSource(): BufferSourceLike;
}
/**
 * - createContext: the caller picks the constructor (`window.AudioContext || window.webkitAudioContext` in v4).
 *   It may throw; the original swallows that inside playTick/playBoom and retries on the next call.
 * - random: replaces `Math.random` (used for the noise of the boom).
 * Sounds: the context is created lazily on the first call and reused. `dispose()` closes it if it exists and
 * turns later calls into no-ops (DEVIATION: the original never closes it). Idempotent.
 */
export interface SoundsEnv {
  createContext(): AudioContextLike;
  random(): number;
}
export interface Sounds {
  playTick(freq: number): void;
  playBoom(): void;
  dispose(): void;
}
export type CreateSounds = (env: SoundsEnv) => Sounds;

// ---------- W6 (PROVISIONAL) and W3 (PENDING) boundaries ----------

/** What both v4 explosion versions read from the cover: its size and its `.explosion-3d` canvas. PROVISIONAL. */
export interface ExplosionTarget {
  getBoundingClientRect(): { readonly width: number; readonly height: number };
  readonly canvas: unknown | null;
}
/** v4: `(window.run3DExplosion || runCanvasExplosion)(cover)`. Returns false only when there is no canvas. */
export type ExplosionFn = (target: ExplosionTarget) => boolean;
/** W3 hook (spawnParticles / spawnBlackoutSmoke / spawnSmoke). Optional until the W3 decision. */
export interface FallbackEffects {
  particles(): void;
  blackout(): void;
  smoke(): void;
}

// ---------- W2: detonation (countdown + runExplosion) ----------

/**
 * `detonate()` = original `detonateCategory` (guarded by `dataset.done`): count 3,2,1 (700 ms apart), 650 ms after
 * the last tick run `runExplosion`: boom, flash restart, "shake" for 500 ms, the explosion call (or the W3
 * fallback when it returns false, smoke after 150 ms) and, 2200 ms later, `reveal()`.
 * `dispose()` (DEVIATION, new): clear every pending timer so nothing fires after unmount. Idempotent.
 */
export interface DetonationEnv {
  parts: CoverParts;
  timers: TimerApi;
  sounds: Pick<Sounds, "playTick" | "playBoom">;
  explode: ExplosionFn;
  explosionTarget: ExplosionTarget;
  fallback: FallbackEffects | null;
  /** W7 `revealProjects(parts)` bound by the caller. */
  reveal: () => void;
}
export interface Detonation {
  detonate(): void;
  dispose(): void;
}
export type CreateDetonation = (env: DetonationEnv) => Detonation;
