// STATUS: UNVERIFIED (Claude draft; exercised against the verbatim v4 fixtures in the cloud sandbox, not yet on the owner's machine)
/**
 * Shared fake world for the v7 works tests (W1, W2, W4, W5, W7; W3/W6 layers come later).
 *
 * ONE fake world is exposed in two ways:
 *   - as the `window`/`document`/timers/IntersectionObserver/... GLOBALS the ORIGINAL v4 code expects
 *     (Scene.runOriginal runs a verbatim fixture from tests/fixtures inside node:vm), and
 *   - as the injected objects of lib/works/contract.ts (Scene.env() / parts() / ... ) for the PORTED code.
 * compareRuns() builds two identical worlds, runs the original in A and the port in B, applies the same steps
 * to both and asserts identical observable behaviour after the mount and after every step.
 *
 * What "observable behaviour" means here:
 *   - `world.log`: one line per WRITE or call that reaches a fake element, window listener registration aside:
 *     style writes, classList add/remove, textContent, dataset writes, play()/pause()/muted, reflow reads
 *     (`offsetWidth`), appendChild/remove, IntersectionObserver creation/observe/disconnect, audio node calls,
 *     explosion stub calls. Every line is prefixed with the virtual time: "@700 countdown[0].textContent=2".
 *     So timing constants (700, 650, 2200, ...) are verified, not just final states.
 *   - `world.snapshot()`: the final state of every fake element.
 *
 * Simplifications (identical for original and port, so they never cause a mismatch):
 *   - Time is virtual. `clock.advance(ms)` runs timers in due order and animation frames on 16 ms boundaries.
 *     Timers run before frames when both fall on the same instant.
 *   - `video.play()` dispatches its "play" event synchronously (browsers do it a task later).
 *   - `getBoundingClientRect()` / `offsetWidth` return whatever the test put in `el.rect`.
 *   - Window listeners are deduplicated by function identity like the DOM. Registration options are compared
 *     through `world.listenerRegistrations` ("scroll:{\"passive\":true}", "resize:none"), not through `log`.
 *   - Math.random is replaced by a seeded generator (`world.random`), the same seed in both worlds.
 */
import vm from "node:vm";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type {
  AudioBufferLike, AudioContextLike, AudioNodeLike, AudioParamLike, BiquadLike, BufferSourceLike, CoverParts,
  DetonationEnv, ExplosionTarget, FillHeadingEnv, GainLike, IntersectionEntryLike, IntersectionObserverLike,
  ListenerOpts, OscillatorLike, PlaybackEnv, ScrollWin, SectionResetEnv, Sounds, SoundsEnv, TimerApi, VideoLike,
} from "../../lib/works/contract";

const readFixture = (name: string): string => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");

/** Verbatim v4 blocks. Never edit these files (tests/works-fixtures.test.ts guards them with sha256). */
export const FIXTURE_FILES = {
  fillHeading: "works-original-fill-heading.js", //  index.html:2631-2659
  playback: "works-original-playback.js", //         index.html:2301-2356
  category: "works-original-category.js", //         index.html:2358-2629
  explosionEnh: "works-original-explosion-enh.js", // js/enhancements.js:19-63
} as const;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================ virtual clock

export const FRAME_MS = 16;

export class Clock {
  now = 0;
  private seq = 1;
  private readonly timers = new Map<number, { due: number; fn: () => void }>();
  private readonly frames = new Map<number, (t: number) => void>();

  readonly setTimeout = (fn: () => void, ms?: number): number => {
    const id = this.seq++;
    this.timers.set(id, { due: this.now + Math.max(0, Number(ms) || 0), fn });
    return id;
  };
  readonly clearTimeout = (id: number): void => {
    this.timers.delete(id);
  };
  readonly requestAnimationFrame = (fn: (t: number) => void): number => {
    const id = this.seq++;
    this.frames.set(id, fn);
    return id;
  };
  readonly cancelAnimationFrame = (id: number): void => {
    this.frames.delete(id);
  };

  pending(): { timers: number; frames: number } {
    return { timers: this.timers.size, frames: this.frames.size };
  }

  private nextTimerDue(): number {
    let m = Infinity;
    for (const t of this.timers.values()) if (t.due < m) m = t.due;
    return m;
  }
  private nextFrameTime(): number {
    return this.frames.size ? (Math.floor(this.now / FRAME_MS) + 1) * FRAME_MS : Infinity;
  }
  private runDueTimers(): void {
    for (;;) {
      let bestId = -1;
      let best = Infinity;
      for (const [id, t] of this.timers) {
        if (t.due <= this.now && t.due < best) {
          best = t.due;
          bestId = id;
        }
      }
      if (bestId < 0) return;
      const rec = this.timers.get(bestId);
      this.timers.delete(bestId);
      rec?.fn();
    }
  }

  /** Moves time forward by `ms`, firing due timers (in due order) and animation frames (16 ms boundaries). */
  advance(ms: number): void {
    const target = this.now + ms;
    for (;;) {
      const nt = this.nextTimerDue();
      const nf = this.nextFrameTime();
      const t = Math.min(nt, nf);
      if (t > target) break;
      this.now = t;
      const dueFrames = t === nf ? [...this.frames.keys()] : [];
      this.runDueTimers();
      for (const id of dueFrames) {
        const f = this.frames.get(id);
        if (f) {
          this.frames.delete(id);
          f(this.now);
        }
      }
    }
    this.now = target;
  }

  /** Runs the animation frames queued right now at the CURRENT time (time does not move). */
  flushFrames(): void {
    const ids = [...this.frames.keys()];
    for (const id of ids) {
      const f = this.frames.get(id);
      if (f) {
        this.frames.delete(id);
        f(this.now);
      }
    }
  }
}

// ============================================================ fake elements

type Rect = { top: number; bottom: number; left: number; right: number; width: number; height: number };
export type Listener = (e?: unknown) => void;

/**
 * Inline style of a fake element. Unset properties read as "" like the DOM. The named properties exist only so
 * the fake satisfies the (required-property) shapes of lib/works/contract.ts; any other name works too.
 */
export interface StyleBag {
  [prop: string]: string;
  animationDelay: string;
  clipPath: string;
  display: string;
  opacity: string;
}

export class FakeClassList {
  private readonly set = new Set<string>();
  constructor(private readonly owner: FakeEl) {}
  readonly add = (...t: string[]): void => {
    this.owner.world.note(`${this.owner.name}.class.add(${t.join(",")})`);
    t.forEach((x) => this.set.add(x));
  };
  readonly remove = (...t: string[]): void => {
    this.owner.world.note(`${this.owner.name}.class.remove(${t.join(",")})`);
    t.forEach((x) => this.set.delete(x));
  };
  contains(t: string): boolean {
    return this.set.has(t);
  }
  init(...t: string[]): void {
    t.forEach((x) => this.set.add(x));
  }
  list(): string[] {
    return [...this.set].sort();
  }
}

export class FakeEl {
  readonly style: StyleBag;
  readonly dataset: Record<string, string | undefined>;
  readonly classList: FakeClassList;
  /** selector -> result of `querySelector`/`querySelectorAll` (null = absent). Filled by the scene builders. */
  readonly queries = new Map<string, FakeEl | FakeEl[] | null>();
  readonly listeners = new Map<string, Listener[]>();
  readonly children: FakeEl[] = [];
  rect: Rect = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
  private readonly styleStore: Record<string, string> = {};
  private readonly dataStore: Record<string, string | undefined> = {};
  private text = "";

  constructor(readonly world: World, readonly name: string) {
    this.classList = new FakeClassList(this);
    this.style = new Proxy(this.styleStore, {
      get: (t, p) => {
        // CSSStyleDeclaration.setProperty (custom properties such as --px). Runtime only: not typed on StyleBag yet.
        if (p === "setProperty") {
          return (n: string, v: string): void => {
            this.world.note(`${this.name}.style.setProperty(${n},${v})`);
            t[n] = String(v);
          };
        }
        return typeof p === "string" ? (t[p] ?? "") : undefined;
      },
      set: (t, p, v) => {
        if (typeof p === "string") {
          this.world.note(`${this.name}.style.${p}=${String(v)}`);
          t[p] = String(v);
        }
        return true;
      },
    }) as StyleBag;
    this.dataset = new Proxy(this.dataStore, {
      get: (t, p) => (typeof p === "string" ? t[p] : undefined),
      set: (t, p, v) => {
        if (typeof p === "string") {
          this.world.note(`${this.name}.dataset.${p}=${String(v)}`);
          t[p] = String(v);
        }
        return true;
      },
    });
  }

  /** Silent initial state (writes nothing to the log). */
  init(spec: { style?: Record<string, string>; dataset?: Record<string, string>; classes?: string[]; text?: string }): this {
    Object.assign(this.styleStore, spec.style);
    Object.assign(this.dataStore, spec.dataset);
    spec.classes?.forEach((c) => this.classList.init(c));
    if (spec.text !== undefined) this.text = spec.text;
    return this;
  }

  get textContent(): string {
    return this.text;
  }
  set textContent(v: string) {
    this.world.note(`${this.name}.textContent=${v}`);
    this.text = v;
  }
  set innerHTML(v: string) {
    this.world.note(`${this.name}.innerHTML=${v}`);
    this.children.length = 0;
  }
  get offsetWidth(): number {
    this.world.note(`${this.name}.offsetWidth(reflow)`);
    return this.rect.width;
  }
  getBoundingClientRect(): Rect {
    return { ...this.rect };
  }
  /** The `.explosion-3d` canvas of a cover (what ExplosionTarget exposes). */
  get canvas(): FakeEl | null {
    return this.querySelector(".explosion-3d");
  }
  querySelector(sel: string): FakeEl | null {
    const r = this.queries.get(sel);
    return Array.isArray(r) ? (r[0] ?? null) : (r ?? null);
  }
  querySelectorAll(sel: string): FakeEl[] {
    const r = this.queries.get(sel);
    return Array.isArray(r) ? r : r ? [r] : [];
  }
  appendChild(child: FakeEl): FakeEl {
    this.world.note(`${this.name}.appendChild(${child.name})`);
    this.children.push(child);
    return child;
  }
  addEventListener(type: string, fn: Listener, _opts?: unknown): void {
    const l = this.listeners.get(type) ?? [];
    if (!l.includes(fn)) l.push(fn);
    this.listeners.set(type, l);
  }
  removeEventListener(type: string, fn: Listener): void {
    const l = this.listeners.get(type);
    if (l) this.listeners.set(type, l.filter((f) => f !== fn));
  }
  dispatch(type: string, ev?: unknown): void {
    [...(this.listeners.get(type) ?? [])].forEach((f) => f(ev));
  }
  listenerCount(type: string): number {
    return this.listeners.get(type)?.length ?? 0;
  }
  state(): Record<string, unknown> {
    return {
      name: this.name,
      style: { ...this.styleStore },
      dataset: { ...this.dataStore },
      classes: this.classList.list(),
      text: this.text,
      children: this.children.map((c) => c.name),
    };
  }
}

export class FakeVideo extends FakeEl implements VideoLike {
  paused = true;
  /** "reject" makes play() reject (autoplay blocked): the video stays paused and no "play" event fires. */
  playOutcome: "resolve" | "reject" = "resolve";
  private mutedValue = false;

  get muted(): boolean {
    return this.mutedValue;
  }
  set muted(v: boolean) {
    this.world.note(`${this.name}.muted=${v}`);
    this.mutedValue = v;
  }
  play(): Promise<void> {
    this.world.note(`${this.name}.play()`);
    if (this.playOutcome === "reject") return Promise.reject(new Error("NotAllowedError"));
    this.paused = false;
    this.dispatch("play");
    return Promise.resolve();
  }
  pause(): void {
    this.world.note(`${this.name}.pause()`);
    this.paused = true;
  }
  /** The USER starts playback with the native controls. */
  userPlay(): void {
    this.world.note(`${this.name}.userPlay`);
    this.paused = false;
    this.dispatch("play");
  }
  override state(): Record<string, unknown> {
    return { ...super.state(), paused: this.paused, muted: this.mutedValue };
  }
}

// ============================================================ fake IntersectionObserver

type IOCallback = (entries: readonly IntersectionEntryLike[]) => void;
const nameOf = (o: object): string => (o instanceof FakeEl ? o.name : "?");

export class FakeIO implements IntersectionObserverLike {
  readonly targets: object[] = [];
  live = true;
  constructor(private readonly w: World, readonly callback: IOCallback, readonly init: { threshold: number }) {
    w.observers.push(this);
    w.note(`io.new threshold=${init.threshold}`);
  }
  observe(target: object): void {
    this.targets.push(target);
    this.w.note(`io.observe(${nameOf(target)})`);
  }
  disconnect(): void {
    this.targets.length = 0;
    this.live = false;
    this.w.note("io.disconnect");
  }
}

// ============================================================ fake Web Audio

export type SoundEvent = { t: number; kind: "tick"; freq: number } | { t: number; kind: "boom" };
export type AudioMode = "standard" | "webkit" | "suspended" | "none" | "throws";

class FakeParam implements AudioParamLike {
  /** Last value written through `.value =` (the v4 tick does that; the boom uses setValueAtTime). */
  assigned: number | undefined = undefined;
  private v: number;
  constructor(private readonly w: World, private readonly label: string, initial: number) {
    this.v = initial;
  }
  get value(): number {
    return this.v;
  }
  set value(x: number) {
    this.w.note(`${this.label}.value=${x}`);
    this.v = x;
    this.assigned = x;
  }
  setValueAtTime(x: number, t: number): this {
    this.w.note(`${this.label}.setValueAtTime(${x},${t})`);
    return this;
  }
  exponentialRampToValueAtTime(x: number, t: number): this {
    this.w.note(`${this.label}.exponentialRampToValueAtTime(${x},${t})`);
    return this;
  }
}

class FakeNode implements AudioNodeLike {
  constructor(protected readonly w: World, readonly label: string) {}
  connect(dest: AudioNodeLike): AudioNodeLike {
    this.w.note(`${this.label}.connect(${(dest as FakeNode).label})`);
    return dest;
  }
}

class FakeOsc extends FakeNode implements OscillatorLike {
  readonly frequency: FakeParam;
  private typeValue = "sine";
  constructor(w: World, label: string) {
    super(w, label);
    this.frequency = new FakeParam(w, `${label}.frequency`, 440);
  }
  get type(): string {
    return this.typeValue;
  }
  set type(v: string) {
    this.w.note(`${this.label}.type=${v}`);
    this.typeValue = v;
  }
  start(): void {
    this.w.note(`${this.label}.start()`);
    if (this.frequency.assigned !== undefined) {
      this.w.soundLog.push({ t: this.w.clock.now, kind: "tick", freq: this.frequency.assigned });
    }
  }
  stop(when?: number): void {
    this.w.note(`${this.label}.stop(${when})`);
  }
}

class FakeGain extends FakeNode implements GainLike {
  readonly gain: FakeParam;
  constructor(w: World, label: string) {
    super(w, label);
    this.gain = new FakeParam(w, `${label}.gain`, 1);
  }
}

class FakeBiquad extends FakeNode implements BiquadLike {
  readonly frequency: FakeParam;
  private typeValue = "lowpass";
  constructor(w: World, label: string) {
    super(w, label);
    this.frequency = new FakeParam(w, `${label}.frequency`, 350);
  }
  get type(): string {
    return this.typeValue;
  }
  set type(v: string) {
    this.w.note(`${this.label}.type=${v}`);
    this.typeValue = v;
  }
}

class FakeBuffer implements AudioBufferLike {
  readonly data: Float32Array;
  constructor(length: number) {
    this.data = new Float32Array(length);
  }
  getChannelData(_channel: number): Float32Array {
    return this.data;
  }
  checksum(): string {
    let s = 0;
    for (let i = 0; i < this.data.length; i++) s += this.data[i];
    return s.toFixed(6);
  }
}

class FakeSource extends FakeNode implements BufferSourceLike {
  private bufferValue: AudioBufferLike | null = null;
  get buffer(): AudioBufferLike | null {
    return this.bufferValue;
  }
  set buffer(b: AudioBufferLike | null) {
    this.w.note(`${this.label}.buffer=${b instanceof FakeBuffer ? `buffer(${b.data.length})` : "null"}`);
    this.bufferValue = b;
  }
  start(): void {
    const sum = this.bufferValue instanceof FakeBuffer ? this.bufferValue.checksum() : "none";
    this.w.note(`${this.label}.start() noise-checksum=${sum}`);
    this.w.soundLog.push({ t: this.w.clock.now, kind: "boom" });
  }
}

export class FakeAudioContext implements AudioContextLike {
  readonly id: number;
  state: string;
  readonly sampleRate = 44100;
  closed = false;
  readonly destination: FakeNode;
  private nodeSeq = 1;
  constructor(readonly w: World, state = "running") {
    this.id = w.audioContexts.length + 1;
    w.audioContexts.push(this);
    this.state = state;
    w.note(`audio.new#${this.id}`);
    this.destination = new FakeNode(w, `a${this.id}.destination`);
  }
  get currentTime(): number {
    return this.w.clock.now / 1000;
  }
  private label(kind: string): string {
    return `a${this.id}.${kind}${this.nodeSeq++}`;
  }
  resume(): Promise<void> {
    this.w.note(`a${this.id}.resume()`);
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.w.note(`a${this.id}.close()`);
    this.closed = true;
    this.state = "closed";
    return Promise.resolve();
  }
  createOscillator(): FakeOsc {
    const n = new FakeOsc(this.w, this.label("osc"));
    this.w.note(`a${this.id}.createOscillator() -> ${n.label}`);
    return n;
  }
  createGain(): FakeGain {
    const n = new FakeGain(this.w, this.label("gain"));
    this.w.note(`a${this.id}.createGain() -> ${n.label}`);
    return n;
  }
  createBiquadFilter(): FakeBiquad {
    const n = new FakeBiquad(this.w, this.label("biquad"));
    this.w.note(`a${this.id}.createBiquadFilter() -> ${n.label}`);
    return n;
  }
  createBuffer(channels: number, length: number, sampleRate: number): FakeBuffer {
    this.w.note(`a${this.id}.createBuffer(${channels},${length},${sampleRate})`);
    return new FakeBuffer(length);
  }
  createBufferSource(): FakeSource {
    const n = new FakeSource(this.w, this.label("source"));
    this.w.note(`a${this.id}.createBufferSource() -> ${n.label}`);
    return n;
  }
}

// ============================================================ world

export type Step =
  | { op: "scroll" } // fire the window "scroll" listeners
  | { op: "resize"; width?: number; height?: number } // change the window size, fire "resize"
  | { op: "frame" } // flush queued animation frames at the current time
  | { op: "advance"; ms: number } // move the clock (timers and frames fire in order)
  | { op: "do"; label: string; original?: (w: World) => void; ported?: (w: World) => void }
  | { op: "top"; v: number } // FillScene: heading rect.top, silent
  | { op: "rect"; i: number; top: number; bottom: number } // PlaybackScene: card rect, silent
  | { op: "userPlay"; i: number } // PlaybackScene: the user presses play on video i
  | { op: "click"; cat?: number } // CategoryScene: click the cover
  | { op: "io"; cat?: number; isIntersecting: boolean; top: number }; // CategoryScene: IntersectionObserver entry

export interface BaseOpts {
  vh?: number;
  vw?: number;
  seed?: number;
}

export interface FakeWindow extends ScrollWin {
  readonly innerWidth: number;
  readonly devicePixelRatio: number;
  readonly AudioContext: (new () => FakeAudioContext) | undefined;
  readonly webkitAudioContext: (new () => FakeAudioContext) | undefined;
  readonly run3DExplosion: ((cover: FakeEl) => boolean) | undefined;
}

const optsKey = (o?: ListenerOpts): string => (o === undefined ? "none" : JSON.stringify(o));

export abstract class World {
  readonly clock = new Clock();
  readonly log: string[] = [];
  readonly random: () => number;
  readonly els: FakeEl[] = [];
  readonly byId = new Map<string, FakeEl>();
  readonly selectors = new Map<string, FakeEl[]>();
  readonly observers: FakeIO[] = [];
  readonly audioContexts: FakeAudioContext[] = [];
  /** tick/boom events: derived from the fake audio nodes (original or real W4) or recorded by `recordingSounds`. */
  readonly soundLog: SoundEvent[] = [];
  /** "scroll:{\"passive\":true}", "resize:none", ... in registration order. */
  readonly listenerRegistrations: string[] = [];
  side: "original" | "ported" = "original";
  vh: number;
  vw: number;
  protected audioMode: AudioMode = "none";
  private readonly winL: Record<"scroll" | "resize", Map<() => void, string>> = { scroll: new Map(), resize: new Map() };
  private winObj: FakeWindow | null = null;

  constructor(opts: BaseOpts) {
    this.vh = opts.vh ?? 800;
    this.vw = opts.vw ?? 1200;
    this.random = mulberry32(opts.seed ?? 1);
  }

  note(msg: string): void {
    this.log.push(`@${this.clock.now} ${msg}`);
  }
  el(name: string): FakeEl {
    const e = new FakeEl(this, name);
    this.els.push(e);
    return e;
  }
  video(name: string): FakeVideo {
    const v = new FakeVideo(this, name);
    this.els.push(v);
    return v;
  }
  lines(re: RegExp): string[] {
    return this.log.filter((l) => re.test(l));
  }

  // ---------- window / document (shared by both consumers) ----------
  win(): FakeWindow {
    if (this.winObj) return this.winObj;
    const w = this;
    this.winObj = {
      get innerHeight() {
        return w.vh;
      },
      get innerWidth() {
        return w.vw;
      },
      devicePixelRatio: 1,
      get AudioContext() {
        return w.audioCtorFor("AudioContext");
      },
      get webkitAudioContext() {
        return w.audioCtorFor("webkitAudioContext");
      },
      get run3DExplosion() {
        return w.explodeStubForOriginal();
      },
      addEventListener: (type, fn, opts) => {
        w.winL[type].set(fn, optsKey(opts));
        w.listenerRegistrations.push(`${type}:${optsKey(opts)}`);
      },
      removeEventListener: (type, fn) => {
        w.winL[type].delete(fn);
      },
      requestAnimationFrame: w.clock.requestAnimationFrame,
      cancelAnimationFrame: w.clock.cancelAnimationFrame,
      setTimeout: w.clock.setTimeout,
      clearTimeout: w.clock.clearTimeout,
    };
    return this.winObj;
  }
  timers(): TimerApi {
    return { setTimeout: this.clock.setTimeout, clearTimeout: this.clock.clearTimeout };
  }
  fire(type: "scroll" | "resize"): void {
    [...this.winL[type].keys()].forEach((f) => f());
  }
  fireIO(target: FakeEl, isIntersecting: boolean, top: number): void {
    for (const o of [...this.observers]) {
      if (o.targets.includes(target)) o.callback([{ target, isIntersecting, boundingClientRect: { top } }]);
    }
  }

  protected audioCtorFor(prop: "AudioContext" | "webkitAudioContext"): (new () => FakeAudioContext) | undefined {
    const m = this.audioMode;
    if (m === "throws") return prop === "AudioContext" ? this.throwingCtor() : undefined;
    if (m === "webkit") return prop === "webkitAudioContext" ? this.audioCtor() : undefined;
    if (m === "standard" || m === "suspended") return prop === "AudioContext" ? this.audioCtor() : undefined;
    return undefined;
  }
  private audioCtor(): new () => FakeAudioContext {
    const w = this;
    const state = this.audioMode === "suspended" ? "suspended" : "running";
    return class extends FakeAudioContext {
      constructor() {
        super(w, state);
      }
    };
  }
  private throwingCtor(): new () => FakeAudioContext {
    return class {
      constructor() {
        throw new Error("audio unavailable");
      }
    } as unknown as new () => FakeAudioContext;
  }
  /** What `window.run3DExplosion` is for the original. The base world has none. */
  protected explodeStubForOriginal(): ((cover: FakeEl) => boolean) | undefined {
    return undefined;
  }

  /** The port's equivalent of `new (window.AudioContext || window.webkitAudioContext)()`. */
  audioFactory(): () => AudioContextLike {
    return () => {
      const C = this.audioCtorFor("AudioContext") ?? this.audioCtorFor("webkitAudioContext");
      if (!C) throw new TypeError("AudioContext is not a constructor");
      return new C();
    };
  }
  soundsEnv(): SoundsEnv {
    return { createContext: this.audioFactory(), random: this.random };
  }
  /** Port-side stand-in for W4: records tick/boom into `soundLog`. */
  recordingSounds(): Pick<Sounds, "playTick" | "playBoom"> {
    return {
      playTick: (freq) => {
        this.soundLog.push({ t: this.clock.now, kind: "tick", freq });
      },
      playBoom: () => {
        this.soundLog.push({ t: this.clock.now, kind: "boom" });
      },
    };
  }

  // ---------- running the ORIGINAL (verbatim fixture inside node:vm) ----------
  protected doc() {
    const w = this;
    let n = 0;
    return {
      hidden: false,
      getElementById: (id: string): FakeEl | null => w.byId.get(id) ?? null,
      querySelector: (sel: string): FakeEl | null => w.selectors.get(sel)?.[0] ?? null,
      querySelectorAll: (sel: string): FakeEl[] => w.selectors.get(sel) ?? [],
      createElement: (tag: string): FakeEl => w.el(`<${tag}#${++n}>`),
      addEventListener: (): void => {},
      removeEventListener: (): void => {},
    };
  }
  protected globals(): Record<string, unknown> {
    const w = this;
    const M: Math = Object.create(Math);
    Object.defineProperty(M, "random", { value: this.random });
    const IO = class extends FakeIO {
      constructor(cb: IOCallback, init?: { threshold?: number }) {
        super(w, cb, { threshold: init?.threshold ?? 0 });
      }
    };
    return {
      window: this.win(),
      document: this.doc(),
      performance: { now: () => w.clock.now },
      requestAnimationFrame: w.clock.requestAnimationFrame,
      cancelAnimationFrame: w.clock.cancelAnimationFrame,
      setTimeout: w.clock.setTimeout,
      clearTimeout: w.clock.clearTimeout,
      IntersectionObserver: IO,
      Math: M,
      Array,
      Number,
      String,
    };
  }
  /** Runs `prefix + fixture + footer` as the body of a sloppy-mode function (like the v4 inline script). */
  protected runFixture(file: string, prefix = "", footer = ""): unknown {
    return vm.runInNewContext(`(function(){${prefix}\n${readFixture(file)}\n${footer}\n})()`, this.globals());
  }

  // ---------- steps ----------
  apply(step: Step): void {
    switch (step.op) {
      case "scroll":
        this.fire("scroll");
        break;
      case "resize":
        if (step.width !== undefined) this.vw = step.width;
        if (step.height !== undefined) this.vh = step.height;
        this.fire("resize");
        break;
      case "frame":
        this.clock.flushFrames();
        break;
      case "advance":
        this.clock.advance(step.ms);
        break;
      case "do": {
        const f = this.side === "original" ? step.original : step.ported;
        f?.(this);
        break;
      }
      default:
        this.applyScene(step);
    }
  }
  protected applyScene(step: Step): void {
    throw new Error(`step not supported by this scene: ${JSON.stringify(step)}`);
  }

  // ---------- observation ----------
  snapshot(): Array<Record<string, unknown>> {
    return this.els.map((e) => e.state());
  }
  /** Live resources. NOT part of parity: use it for teardown/dispose tests. */
  resources(): Record<string, number> {
    const p = this.clock.pending();
    return {
      scroll: this.winL.scroll.size,
      resize: this.winL.resize.size,
      timers: p.timers,
      frames: p.frames,
      observersLive: this.observers.filter((o) => o.live).length,
      audioContexts: this.audioContexts.length,
      audioClosed: this.audioContexts.filter((c) => c.closed).length,
      ...this.extraResources(),
    };
  }
  protected extraResources(): Record<string, number> {
    return {};
  }
}

// ============================================================ scene: W5 fill heading

export interface FillOpts extends BaseOpts {
  /** heading rect.top at mount (default 1000). */
  top?: number;
  reduceMotion?: boolean;
}

export class FillScene extends World {
  readonly heading: FakeEl;
  readonly fill: FakeEl;
  readonly reduceMotion: boolean;
  constructor(opts: FillOpts = {}) {
    super(opts);
    this.reduceMotion = opts.reduceMotion ?? false;
    this.heading = this.el("heading");
    this.fill = this.el("fill");
    this.heading.rect = { ...this.heading.rect, top: opts.top ?? 1000 };
    this.heading.queries.set(".sfh-fill", this.fill);
    this.byId.set("portfolioFillHeading", this.heading);
  }
  runOriginal(): void {
    this.runFixture(FIXTURE_FILES.fillHeading, `var reduceMotion = ${this.reduceMotion};`);
  }
  env(): FillHeadingEnv {
    return { win: this.win(), heading: this.heading, fill: this.fill, reduceMotion: this.reduceMotion };
  }
  protected override applyScene(step: Step): void {
    if (step.op === "top") this.heading.rect = { ...this.heading.rect, top: step.v };
    else super.applyScene(step);
  }
}

// ============================================================ scene: W1 playback

export interface PlaybackOpts extends BaseOpts {
  /** number of `.stack-card` (default 4). */
  cards?: number;
  /** indices of cards that have no <video>. */
  noVideo?: number[];
  playOutcome?: "resolve" | "reject";
}

export class PlaybackScene extends World {
  readonly cards: FakeEl[] = [];
  readonly videos: Array<FakeVideo | null> = [];
  constructor(opts: PlaybackOpts = {}) {
    super(opts);
    const n = opts.cards ?? 4;
    for (let i = 0; i < n; i++) {
      const card = this.el(`card[${i}]`);
      card.rect = { ...card.rect, top: 2000 + i * 600, bottom: 2600 + i * 600 };
      let video: FakeVideo | null = null;
      if (!opts.noVideo?.includes(i)) {
        video = this.video(`video[${i}]`);
        video.playOutcome = opts.playOutcome ?? "resolve";
        card.queries.set("video", video);
      }
      this.cards.push(card);
      this.videos.push(video);
    }
    this.selectors.set(".stack-card", this.cards);
    this.selectors.set("video", this.videos.filter((v): v is FakeVideo => v !== null));
  }
  runOriginal(): void {
    this.runFixture(FIXTURE_FILES.playback);
  }
  env(): PlaybackEnv {
    return {
      win: this.win(),
      cards: this.cards.map((c, i) => ({ getBoundingClientRect: () => c.getBoundingClientRect(), video: () => this.videos[i] })),
      allVideos: this.videos.filter((v): v is FakeVideo => v !== null),
    };
  }
  protected override applyScene(step: Step): void {
    if (step.op === "rect") this.cards[step.i].rect = { ...this.cards[step.i].rect, top: step.top, bottom: step.bottom };
    else if (step.op === "userPlay") this.videos[step.i]?.userPlay();
    else super.applyScene(step);
  }
  protected override extraResources(): Record<string, number> {
    return { playListeners: this.videos.reduce((s, v) => s + (v ? v.listenerCount("play") : 0), 0) };
  }
}

// ============================================================ scene: W2/W4/W7 category

export interface CategoryOpts extends BaseOpts {
  /** data-cat ids, one cover/section each (default ["social"]). */
  cats?: string[];
  /** stack cards per category (default 4). */
  cards?: number;
  /** AudioContext availability (default "none": the original swallows the failure and plays nothing). */
  audio?: AudioMode;
  /** What the explosion stub returns (both for `window.run3DExplosion` and the port's `explode`). Default true. */
  explode?: boolean;
  /** Elements that are absent from the markup. */
  missing?: Array<"cta" | "bomb" | "countdown" | "flash" | "projects">;
}

export interface CatEls {
  cat: string;
  section: FakeEl;
  cover: FakeEl;
  cta: FakeEl | null;
  bomb: FakeEl | null;
  countdown: FakeEl | null;
  flash: FakeEl | null;
  canvas: FakeEl;
  particles: FakeEl;
  projects: FakeEl | null;
  cards: FakeEl[];
}

/** The inner functions of the verbatim category fixture, exposed by a footer (the fixture file is untouched). */
export interface OriginalCategory {
  playTick(freq: number): void;
  playBoom(): void;
  spawnParticles(cover: FakeEl): void;
  spawnSmoke(cover: FakeEl): void;
  spawnBlackoutSmoke(cover: FakeEl): void;
  detonateCategory(cover: FakeEl): void;
  runCanvasExplosion(cover: FakeEl): boolean;
  runExplosion(cover: FakeEl): void;
  resetCategory(cover: FakeEl): void;
}

const CATEGORY_FOOTER =
  "return { playTick, playBoom, spawnParticles, spawnSmoke, spawnBlackoutSmoke, detonateCategory, runCanvasExplosion, runExplosion, resetCategory };";

export class CategoryScene extends World {
  readonly cats: CatEls[] = [];
  private readonly explodeResult: boolean;
  constructor(opts: CategoryOpts = {}) {
    super(opts);
    this.audioMode = opts.audio ?? "none";
    this.explodeResult = opts.explode ?? true;
    const missing = new Set(opts.missing ?? []);
    const ids = opts.cats ?? ["social"];
    const covers: FakeEl[] = [];
    const sections: FakeEl[] = [];
    ids.forEach((cat, i) => {
      const section = this.el(`section[${i}]`);
      const cover = this.el(`cover[${i}]`).init({ dataset: { cat } });
      const opt = (key: "cta" | "bomb" | "countdown" | "flash", name: string): FakeEl | null => (missing.has(key) ? null : this.el(`${name}[${i}]`));
      const cta = opt("cta", "cta");
      const bomb = opt("bomb", "bomb");
      const countdown = opt("countdown", "countdown");
      const flash = opt("flash", "flash");
      const canvas = this.el(`canvas[${i}]`);
      const particles = this.el(`particles[${i}]`);
      const cards: FakeEl[] = [];
      let projects: FakeEl | null = null;
      if (!missing.has("projects")) {
        projects = this.el(`projects[${i}]`).init({ style: { display: "none" }, dataset: { cat } });
        for (let j = 0; j < (opts.cards ?? 4); j++) cards.push(this.el(`card[${i}.${j}]`));
        projects.queries.set(".stack-card", cards);
        this.selectors.set(`.category-projects[data-cat="${cat}"]`, [projects]);
      }
      cover.queries.set(".cat-cover-cta", cta);
      cover.queries.set(".cat-bomb", bomb);
      cover.queries.set(".cat-countdown", countdown);
      cover.queries.set(".explosion-flash", flash);
      cover.queries.set(".explosion-3d", canvas);
      cover.queries.set(".explosion-particles", particles);
      section.queries.set(".category-cover", cover);
      covers.push(cover);
      sections.push(section);
      this.cats.push({ cat, section, cover, cta, bomb, countdown, flash, canvas, particles, projects, cards });
    });
    this.selectors.set(".category-cover", covers);
    this.selectors.set(".category-section", sections);
  }

  runOriginal(): OriginalCategory {
    return this.runFixture(FIXTURE_FILES.category, "", CATEGORY_FOOTER) as OriginalCategory;
  }
  protected override explodeStubForOriginal(): ((cover: FakeEl) => boolean) | undefined {
    return (cover) => this.explodeFn()(cover);
  }
  /** Stub for the explosion (W6): logs "explode(<cover name>)" and returns the configured result. */
  explodeFn(): (target: ExplosionTarget) => boolean {
    return (target) => {
      this.note(`explode(${nameOf(target)})`);
      return this.explodeResult;
    };
  }

  parts(i = 0): CoverParts {
    const c = this.cats[i];
    return {
      cover: c.cover,
      cta: c.cta,
      bomb: c.bomb,
      countdown: c.countdown,
      flash: c.flash,
      projects: c.projects ? { style: c.projects.style, cards: () => c.cards } : null,
    };
  }
  sectionResetEnv(): SectionResetEnv {
    return {
      sections: this.cats.map((c, i) => ({ target: c.section, parts: this.parts(i) })),
      createObserver: (cb, init) => new FakeIO(this, cb, init),
    };
  }
  /** Env for W2 with recording sounds, the explosion stub, no fallback and a no-op reveal. Override per test. */
  detonationEnv(i = 0, over: Partial<DetonationEnv> = {}): DetonationEnv {
    return {
      parts: this.parts(i),
      timers: this.timers(),
      sounds: this.recordingSounds(),
      explode: this.explodeFn(),
      explosionTarget: this.cats[i].cover,
      fallback: null,
      reveal: () => {},
      ...over,
    };
  }
  /** Silently marks category `i` as detonated (what W2 does with `dataset.done = "1"`). */
  markDone(i = 0): void {
    this.cats[i].cover.init({ dataset: { done: "1" } });
  }
  protected override applyScene(step: Step): void {
    if (step.op === "click") this.cats[step.cat ?? 0].cover.dispatch("click");
    else if (step.op === "io") this.fireIO(this.cats[step.cat ?? 0].section, step.isIntersecting, step.top);
    else super.applyScene(step);
  }
  protected override extraResources(): Record<string, number> {
    return { clickListeners: this.cats.reduce((s, c) => s + c.cover.listenerCount("click"), 0) };
  }
}

// ============================================================ comparison

/**
 * `assert.deepStrictEqual` WITHOUT type narrowing. `assert.deepStrictEqual(w.log, [])` narrows `w.log` to `never[]`
 * for the rest of the test (the matcher is declared `asserts actual is T`), which breaks later `w.log.includes(...)`.
 * Use `same(actual, expected, message)` in tests instead.
 */
export function same(actual: unknown, expected: unknown, message?: string): void {
  if (message === undefined) assert.deepStrictEqual(actual, expected);
  else assert.deepStrictEqual(actual, expected, message);
}

/** Log filters for `compareRuns({ only })`. */
/** Drops IntersectionObserver lines (the original's category block creates its observer at mount; W7 owns that). */
export const notIO = (line: string): boolean => !/^@\d+ io\./.test(line);
/** Keeps only the fake Web Audio lines (context creation and node calls). */
export const audioOnly = (line: string): boolean => /^@\d+ (audio\.|a\d+\.)/.test(line);
/** Keeps only the lines whose subject (text after the "@<time> " prefix) starts with one of `prefixes`. */
export const touching =
  (...prefixes: string[]) =>
  (line: string): boolean => {
    const body = line.slice(line.indexOf(" ") + 1);
    return prefixes.some((p) => body.startsWith(p));
  };

export interface CompareArgs<S extends World> {
  /** Builds a fresh world (called twice: A for the original, B for the port). */
  make: () => S;
  /** Runs the ORIGINAL on world A (Scene.runOriginal). */
  original: (s: S) => unknown;
  /** Mounts the PORT on world B. May return a teardown function. */
  port: (s: S) => (() => void) | void;
  steps: Array<Step>;
  /** Flush queued animation frames after every step (default true, like v6). Use false for time-driven scenes. */
  autoFrame?: boolean;
  /** Compare only the log lines accepted by this predicate (default: all). */
  only?: (line: string) => boolean;
  /** Also compare snapshot() of both worlds (default true). Turn off when only part of the behaviour is ported. */
  snapshots?: boolean;
}

export function compareRuns<S extends World>(args: CompareArgs<S>) {
  const a = args.make();
  const b = args.make();
  a.side = "original";
  b.side = "ported";
  args.original(a);
  const unmount = args.port(b);
  const keep = args.only ?? (() => true);
  const check = (when: string): void => {
    assert.deepStrictEqual(b.log.filter(keep), a.log.filter(keep), `log differs ${when}`);
    if (args.snapshots !== false) assert.deepStrictEqual(b.snapshot(), a.snapshot(), `state differs ${when}`);
  };
  check("after mount");
  args.steps.forEach((s, k) => {
    a.apply(s);
    b.apply(s);
    if (args.autoFrame !== false) {
      a.apply({ op: "frame" });
      b.apply({ op: "frame" });
    }
    check(`after step ${k}: ${s.op === "do" ? s.label : JSON.stringify(s)}`);
  });
  return { original: a, ported: b, unmount };
}
