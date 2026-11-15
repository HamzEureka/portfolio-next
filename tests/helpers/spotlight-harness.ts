/**
 * Shared fake DOM for the spotlight tests (v6). ONE fake world is exposed in two ways:
 *   - as the `document`/`window` globals the ORIGINAL v4 code expects (World.runOriginal), and
 *   - as the injected objects of lib/spotlight-ui/contract.ts (World.env / modeCtx / mobileCtx).
 * compareRuns() builds two identical worlds, runs the original in one and the ported code in the
 * other, applies the same steps to both and asserts identical observable output after each step.
 */
import vm from "node:vm";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type {
  CardEl, DotEl, DotsHost, MobileCtx, ModeCtx, MqLike, RectLike, SpotlightEnv,
  TouchEventLike, TouchEventName, TouchTargetLike, WinLike,
} from "../../lib/spotlight-ui/contract";

const ORIGINAL = readFileSync(new URL("../fixtures/spotlight-original.js", import.meta.url), "utf8");

/** aria-label the original gave dot `i`. Use it as `dotLabel` so snapshots match. */
export const DOT_LABEL = (i: number): string => "الاقتباس رقم " + (i + 1);

type Fn = () => void;
type TouchFn = (e: TouchEventLike) => void;

export class FakeDot implements DotEl {
  type = "";
  className = "";
  active = false;
  attrs: Record<string, string> = {};
  private handlers: Fn[] = [];
  setAttribute(name: string, value: string): void { this.attrs[name] = value; }
  addEventListener(type: "click", fn: Fn): void { if (type === "click") this.handlers.push(fn); }
  readonly classList = {
    toggle: (token: string, force?: boolean): boolean => {
      if (token === "active") this.active = force === undefined ? !this.active : force;
      return this.active;
    },
  };
  click(): void { [...this.handlers].forEach((f) => f()); }
}

export interface WorldOpts {
  n: number;
  mobile?: boolean;
  reducedMotion?: boolean;
  innerWidth?: number;
  innerHeight?: number;
  rect?: Partial<RectLike>;
  scrollY?: number;
}

export type Step =
  | { op: "scroll"; top: number }                  // set section rect.top, then fire window "scroll"
  | { op: "rect"; top?: number; height?: number }  // change the section rect silently (no event)
  | { op: "scrollY"; y: number }                   // set window.scrollY silently
  | { op: "resize"; width?: number; height?: number } // set window size, then fire "resize"
  | { op: "mq"; mobile: boolean }                  // flip the (max-width: 720px) query, fire its "change"
  | { op: "tick" }                                  // fire every active setInterval callback once
  | { op: "touch"; type: TouchEventName; x?: number }
  | { op: "dot"; i: number }                        // click dot i
  | { op: "timeouts" }                              // run every pending setTimeout callback
  | { op: "raf" };                                  // run every pending requestAnimationFrame callback

export interface Snapshot {
  cards: Array<{ transform: string; opacity: string; zIndex: string; filter: string }>;
  dots: Array<{ active: boolean; type: string; className: string; aria: string | null }>;
  scrolls: Array<{ top: number; behavior: string }>;
}

export class World {
  readonly cards: CardEl[];
  readonly dots: FakeDot[] = [];
  readonly scrolls: Array<{ top: number; behavior: string }> = [];
  rect: RectLike;
  innerWidth: number;
  innerHeight: number;
  scrollY: number;
  mobile: boolean;
  readonly reducedMotion: boolean;
  readonly n: number;
  /** Set by D1/D2 tests: where a dot click goes when the controller (not the original) owns the dots. */
  dotClickOverride?: (i: number) => void;

  private winL: Record<"scroll" | "resize", Set<Fn>> = { scroll: new Set(), resize: new Set() };
  private touchL: Record<TouchEventName, Set<TouchFn>> = {
    touchstart: new Set(), touchend: new Set(), touchcancel: new Set(),
  };
  private mqL = new Set<Fn>();
  private rafQ = new Map<number, Fn>();
  private intervals = new Map<number, Fn>();
  private timeouts = new Map<number, Fn>();
  private nextId = 1;

  constructor(opts: WorldOpts) {
    this.n = opts.n;
    this.cards = Array.from({ length: opts.n }, () => ({ style: { transform: "", opacity: "", zIndex: "", filter: "" } }));
    this.rect = { top: 0, height: 3000, ...opts.rect };
    this.innerWidth = opts.innerWidth ?? 1200;
    this.innerHeight = opts.innerHeight ?? 800;
    this.scrollY = opts.scrollY ?? 0;
    this.mobile = opts.mobile ?? false;
    this.reducedMotion = opts.reducedMotion ?? false;
    const w = this;
    this.mq = {
      get matches() { return w.mobile; },
      addEventListener: (_t, f) => { w.mqL.add(f); },
      removeEventListener: (_t, f) => { w.mqL.delete(f); },
    };
  }

  // ---------- window / elements (shared by both consumers) ----------
  readonly section = { getBoundingClientRect: (): RectLike => ({ top: this.rect.top, height: this.rect.height }) };

  readonly touchTarget: TouchTargetLike = {
    addEventListener: (t, f) => { this.touchL[t].add(f); },
    removeEventListener: (t, f) => { this.touchL[t].delete(f); },
  };

  private readonly mq: MqLike;

  matchMedia(query: string): MqLike {
    if (query.includes("reduced-motion")) {
      return { matches: this.reducedMotion, addEventListener() {}, removeEventListener() {} };
    }
    return this.mq;
  }

  win(): WinLike {
    const w = this;
    return {
      get innerWidth() { return w.innerWidth; },
      get innerHeight() { return w.innerHeight; },
      get scrollY() { return w.scrollY; },
      matchMedia: (q) => w.matchMedia(q),
      addEventListener: (t, f) => { w.winL[t].add(f); },
      removeEventListener: (t, f) => { w.winL[t].delete(f); },
      scrollTo: (o) => { w.scrolls.push({ top: o.top, behavior: o.behavior }); },
      requestAnimationFrame: (f) => { const id = w.nextId++; w.rafQ.set(id, f); return id; },
      cancelAnimationFrame: (id) => { w.rafQ.delete(id); },
      setInterval: (f) => { const id = w.nextId++; w.intervals.set(id, f); return id; },
      clearInterval: (id) => { w.intervals.delete(id); },
      setTimeout: (f) => { const id = w.nextId++; w.timeouts.set(id, f); return id; },
      clearTimeout: (id) => { w.timeouts.delete(id); },
    };
  }

  // ---------- the ORIGINAL code ----------
  runOriginal(): void {
    const win = this.win();
    const w = this;
    const dotsBox = { appendChild(d: FakeDot) { w.dots.push(d); }, get children() { return w.dots; } };
    const track = { querySelectorAll: () => w.cards, parentElement: w.touchTarget };
    const doc = {
      getElementById: (id: string) => (id === "testimonialsScroll" ? w.section : id === "spotlightTrack" ? track : dotsBox),
      createElement: () => new FakeDot(),
    };
    vm.runInNewContext(`(function(){${ORIGINAL}})()`, {
      document: doc, window: win,
      requestAnimationFrame: win.requestAnimationFrame, cancelAnimationFrame: win.cancelAnimationFrame, setInterval: win.setInterval, clearInterval: win.clearInterval,
      setTimeout: win.setTimeout, clearTimeout: win.clearTimeout,
      Array, Math, Number, String,
    });
  }

  // ---------- the PORTED code ----------
  /** Full environment for mountSpotlight (D3). */
  env(): SpotlightEnv {
    const w = this;
    const dots: DotsHost = {
      create: () => new FakeDot(),
      add: (d) => { w.dots.push(d as FakeDot); },
      remove: (d) => { const k = w.dots.indexOf(d as FakeDot); if (k >= 0) w.dots.splice(k, 1); },
    };
    return { win: this.win(), section: this.section, cards: this.cards, touchTarget: this.touchTarget, dots, dotLabel: DOT_LABEL };
  }

  /** Pre-creates the N dots (as the original does at mount) for tests of a single controller (D1/D2). */
  ensureDots(): void {
    if (this.dots.length) return;
    for (let i = 0; i < this.n; i++) {
      const d = new FakeDot();
      d.type = "button";
      d.className = "spotlight-dot";
      d.setAttribute("aria-label", DOT_LABEL(i));
      this.dots.push(d);
    }
  }

  modeCtx(): ModeCtx {
    this.ensureDots();
    return {
      win: this.win(), section: this.section, cards: this.cards,
      setActiveDot: (i) => { this.dots.forEach((d, k) => d.classList.toggle("active", k === i)); },
    };
  }

  mobileCtx(): MobileCtx {
    return { ...this.modeCtx(), touchTarget: this.touchTarget };
  }

  // ---------- events ----------
  fire(type: "scroll" | "resize"): void { [...this.winL[type]].forEach((f) => f()); }
  setMobile(m: boolean): void { this.mobile = m; [...this.mqL].forEach((f) => f()); }
  flushRaf(): void { const q = [...this.rafQ.values()]; this.rafQ.clear(); q.forEach((f) => f()); }
  tick(): void { [...this.intervals.values()].forEach((f) => f()); }
  runTimeouts(): void { const q = [...this.timeouts.values()]; this.timeouts.clear(); q.forEach((f) => f()); }
  fireTouch(type: TouchEventName, x: number): void {
    const pt = [{ clientX: x }];
    const e: TouchEventLike =
      type === "touchstart" ? { touches: pt, changedTouches: pt }
      : type === "touchend" ? { touches: [], changedTouches: pt }
      : { touches: [], changedTouches: [] };
    [...this.touchL[type]].forEach((f) => f(e));
  }
  clickDot(i: number): void {
    if (this.dotClickOverride) this.dotClickOverride(i);
    else this.dots[i].click();
  }

  // ---------- observation ----------
  snapshot(): Snapshot {
    return {
      cards: this.cards.map((c) => ({
        transform: String(c.style.transform), opacity: String(c.style.opacity),
        zIndex: String(c.style.zIndex), filter: String(c.style.filter),
      })),
      dots: this.dots.map((d) => ({ active: d.active, type: d.type, className: d.className, aria: d.attrs["aria-label"] ?? null })),
      scrolls: this.scrolls.map((s) => ({ ...s })),
    };
  }

  /** Live resources. NOT part of parity (the port may add/remove listeners per mode); use it for teardown tests. */
  resources() {
    return {
      scroll: this.winL.scroll.size, resize: this.winL.resize.size,
      touchstart: this.touchL.touchstart.size, touchend: this.touchL.touchend.size, touchcancel: this.touchL.touchcancel.size,
      mqChange: this.mqL.size, intervals: this.intervals.size, timeouts: this.timeouts.size, raf: this.rafQ.size,
      dots: this.dots.length,
    };
  }
}

export function applyStep(w: World, s: Step): void {
  switch (s.op) {
    case "scroll": w.rect = { ...w.rect, top: s.top }; w.fire("scroll"); break;
    case "rect": w.rect = { top: s.top ?? w.rect.top, height: s.height ?? w.rect.height }; break;
    case "scrollY": w.scrollY = s.y; break;
    case "resize":
      if (s.width !== undefined) w.innerWidth = s.width;
      if (s.height !== undefined) w.innerHeight = s.height;
      w.fire("resize");
      break;
    case "mq": w.setMobile(s.mobile); break;
    case "tick": w.tick(); break;
    case "touch": w.fireTouch(s.type, s.x ?? 0); break;
    case "dot": w.clickDot(s.i); break;
    case "timeouts": w.runTimeouts(); break;
    case "raf": w.flushRaf(); break;
  }
}

export interface CompareArgs {
  opts: WorldOpts;
  steps: Step[];
  /** Mount the PORTED code on world B. May return a teardown function. */
  mount: (b: World) => (() => void) | void;
  /** Flush requestAnimationFrame after every step (default true). Use false to test rAF throttling. */
  flush?: boolean;
}

/**
 * Runs the original in world A and the port in world B, applies `steps` to both and asserts the
 * snapshots are identical after mount and after every step. Returns both worlds for extra asserts.
 */
export function compareRuns(args: CompareArgs) {
  const a = new World(args.opts);
  const b = new World(args.opts);
  a.runOriginal();
  const unmount = args.mount(b);
  assert.deepStrictEqual(b.snapshot(), a.snapshot(), "after mount");
  args.steps.forEach((s, k) => {
    applyStep(a, s);
    applyStep(b, s);
    if (args.flush !== false) { a.flushRaf(); b.flushRaf(); }
    assert.deepStrictEqual(b.snapshot(), a.snapshot(), `after step ${k}: ${JSON.stringify(s)}`);
  });
  return { original: a, ported: b, unmount };
}
