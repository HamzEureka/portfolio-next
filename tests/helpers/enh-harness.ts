// STATUS: UNVERIFIED (Claude proposal). Tiny fake DOM + fake timers/rAF/IntersectionObserver to run the ORIGINAL v4 enhancements.js
// (tests/fixtures/enhancements-original.js, verbatim) and the TS ports against identical worlds. Only what those two need is emulated.
import vm from "node:vm";
import { promises as fs } from "node:fs";
import path from "node:path";

export class FClassList {
  s = new Set<string>();
  constructor(init = "") { init.split(/\s+/).filter(Boolean).forEach((c) => this.s.add(c)); }
  add(...c: string[]) { c.forEach((x) => this.s.add(x)); }
  remove(...c: string[]) { c.forEach((x) => this.s.delete(x)); }
  contains(c: string) { return this.s.has(c); }
}
type Handler = { type: string; fn: (e: any) => void; opts: unknown };
export class FEl {
  attrs: Record<string, string> = {}; kids: FEl[] = []; parent: FEl | null = null;
  classList = new FClassList(); style: Record<string, string> = {}; dataset: Record<string, string> = {};
  scrollHeight = 5000; handlers: Handler[] = []; innerHTML = ""; muted = false; src = "";
  playMode: "ok" | "reject" = "ok"; played = 0; paused = 0;
  constructor(public tag: string) {}
  setAttribute(k: string, v: string) { this.attrs[k] = String(v); if (k === "class") this.classList = new FClassList(String(v)); }
  getAttribute(k: string) { return k in this.attrs ? this.attrs[k] : null; }
  append(...n: FEl[]) { for (const x of n) { x.remove(); x.parent = this; this.kids.push(x); } }
  prepend(n: FEl) { n.remove(); n.parent = this; this.kids.unshift(n); }
  remove() { if (this.parent) { this.parent.kids = this.parent.kids.filter((k) => k !== this); this.parent = null; } }
  addEventListener(type: string, fn: (e: any) => void, opts?: unknown) { this.handlers.push({ type, fn, opts }); }
  removeEventListener(type: string, fn: (e: any) => void) { const i = this.handlers.findIndex((h) => h.type === type && h.fn === fn); if (i >= 0) this.handlers.splice(i, 1); }
  fire(type: string, ev: object = {}) { for (const h of [...this.handlers]) if (h.type === type) h.fn.call(this, { type, target: this, ...ev }); }
  play() { this.played++; return this.playMode === "ok" ? Promise.resolve() : Promise.reject(new Error("NotAllowedError")); }
  pause() { this.paused++; }
  /** Structure only (what a user could observe): tag, attributes, classes, `muted`, children. */
  snap(): any {
    return { tag: this.tag, attrs: Object.fromEntries(Object.entries(this.attrs).filter(([k]) => k !== "class").sort()),
      cls: [...this.classList.s].sort(), muted: this.tag === "video" ? this.muted : undefined, kids: this.kids.map((k) => k.snap()) };
  }
  find(pred: (e: FEl) => boolean): FEl | undefined { if (pred(this)) return this; for (const k of this.kids) { const r = k.find(pred); if (r) return r; } return undefined; }
}

export interface Cfg {
  reduce?: boolean; small?: boolean; connection?: { saveData?: boolean; effectiveType?: string }; storage?: Record<string, string> | "throws";
  noIO?: boolean; noHero?: boolean; noNav?: boolean; scrollHeight?: number; innerHeight?: number; scrollY?: number; videoPlay?: "ok" | "reject";
}

/** One page world: globals object (for the vm run of the original) AND the same objects (for the TS ports). */
export class World {
  g: any; root = new FEl("html"); body = new FEl("body"); head = new FEl("head");
  hero: FEl | null; navLinks: FEl | null; script = new FEl("script");
  storageMap: Record<string, string> = {}; storageWrites: Array<[string, string]> = [];
  timers: Array<{ at: number; fn: () => void; id: number }> = []; now = 0; nextId = 1;
  rafQ: Array<() => void> = []; rafRequests = 0; winHandlers: Array<{ type: string; fn: () => void; opts: unknown }> = [];
  io: Array<{ cb: (e: any[]) => void; observed: any[]; disconnected: boolean }> = [];
  constructor(public cfg: Cfg = {}) {
    this.hero = cfg.noHero ? null : new FEl("section"); if (this.hero) this.hero.setAttribute("class", "hero wrap");
    this.navLinks = cfg.noNav ? null : new FEl("nav");
    this.storageMap = cfg.storage && cfg.storage !== "throws" ? { ...cfg.storage } : {};
    const w = this;
    const doc: any = {
      documentElement: Object.assign(this.root, { scrollHeight: cfg.scrollHeight ?? 5000 }),
      body: this.body, head: this.head, currentScript: this.script,
      createElement: (t: string) => { const e = new FEl(t); if (t === "video") e.playMode = cfg.videoPlay ?? "ok"; return e; },
      querySelector: (s: string) => (s === ".hero" ? w.hero : s === "#navLinks" ? w.navLinks : null),
    };
    this.script.dataset = { poster: "assets/hero-poster.jpg", video: "assets/hero-loop.mp4" };
    this.script.src = "https://x.test/js/enhancements.js";
    const storage = cfg.storage === "throws" ? null : {
      getItem: (k: string) => (k in w.storageMap ? w.storageMap[k] : null),
      setItem: (k: string, v: string) => { w.storageMap[k] = v; w.storageWrites.push([k, v]); },
    };
    const g: any = {
      document: doc, matchMedia: (q: string) => ({ matches: q.includes("prefers-reduced-motion") ? !!cfg.reduce : q.includes("max-width: 720px") ? !!cfg.small : false }),
      navigator: cfg.connection ? { connection: cfg.connection } : {}, innerHeight: cfg.innerHeight ?? 800, innerWidth: 1200, scrollY: cfg.scrollY ?? 0,
      devicePixelRatio: 1, performance: { now: () => w.now },
      addEventListener: (type: string, fn: () => void, opts?: unknown) => { w.winHandlers.push({ type, fn, opts }); },
      removeEventListener: (type: string, fn: () => void) => { const i = w.winHandlers.findIndex((h) => h.type === type && h.fn === fn); if (i >= 0) w.winHandlers.splice(i, 1); },
      requestAnimationFrame: (f: () => void) => { w.rafRequests++; w.rafQ.push(f); return w.rafRequests; },
      setTimeout: (fn: () => void, ms = 0) => { const id = w.nextId++; w.timers.push({ at: w.now + ms, fn, id }); return id; },
      clearTimeout: (id: number) => { w.timers = w.timers.filter((t) => t.id !== id); },
      Math, Object, Array, Promise, RegExp, String, Number, parseInt, Error,
    };
    this.storageObj = storage;
    if (storage) g.localStorage = storage;
    else Object.defineProperty(g, "localStorage", { get() { throw new Error("SecurityError"); } });
    if (!cfg.noIO) g.IntersectionObserver = class { rec: any; constructor(cb: any) { this.rec = { cb, observed: [], disconnected: false }; w.io.push(this.rec); } observe(el: any) { this.rec.observed.push(el); } disconnect() { this.rec.disconnected = true; } };
    g.window = g; g.self = g;
    this.g = g;
  }
  storageObj: { getItem(k: string): string | null; setItem(k: string, v: string): void } | null = null;
  get storage() { return this.storageObj ?? undefined; }
  set(p: Partial<{ scrollY: number; innerHeight: number; scrollHeight: number }>) {
    if (p.scrollY !== undefined) this.g.scrollY = p.scrollY;
    if (p.innerHeight !== undefined) this.g.innerHeight = p.innerHeight;
    if (p.scrollHeight !== undefined) this.root.scrollHeight = p.scrollHeight;
  }
  fireWin(type: string) { for (const h of [...this.winHandlers]) if (h.type === type) h.fn(); }
  flushRaf() { const q = this.rafQ; this.rafQ = []; q.forEach((f) => f()); }
  tick(ms: number) { this.now += ms; for (const t of this.timers.filter((x) => x.at <= this.now).sort((a, b) => a.at - b.at)) { this.timers = this.timers.filter((x) => x !== t); t.fn(); } }
  /** The `env` object the TS ports expect (same objects as the globals). */
  get env() { const g = this.g; return { doc: g.document, win: g, matchMedia: g.matchMedia, navigator: g.navigator, IntersectionObserver: g.IntersectionObserver, requestAnimationFrame: g.requestAnimationFrame, root: this.root, storage: this.storage ?? null, setTimeout: g.setTimeout } as any; }
}

let originalSrc: string | null = null;
/** Run the verbatim v4 enhancements.js inside a vm context built from the world, then fire the stylesheet `load` (which starts everything). */
export async function runOriginal(w: World): Promise<void> {
  originalSrc ??= await fs.readFile(path.join(process.cwd(), "tests", "fixtures", "enhancements-original.js"), "utf8");
  const ctx = vm.createContext(w.g);
  vm.runInContext(originalSrc, ctx, { filename: "enhancements-original.js" });
  const link = w.head.find((e) => e.tag === "link");
  if (link) link.fire("load");
}
/** Let promise callbacks (`v.play().catch(...)`) run. */
export const settle = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };
