// STATUS: UNVERIFIED (Claude draft; M3/T5; run in the cloud sandbox only, not yet on the owner's machine)
/**
 * T5: lib/works/explosion.ts against the verbatim v4 `explode2D` (tests/fixtures/works-original-explosion-enh.js, enhancements.js:19-63).
 * The original runs in node:vm and the port runs in an identical fake world (virtual clock, seeded random, recording Canvas-2D);
 * the full draw-call logs, with virtual timestamps, must be identical. Also: teardown and the browser adapters.
 */
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { Clock, mulberry32, same } from "./helpers/works-harness";
import { DUR, createExplosion, type ExplosionCanvas, type SpriteCanvas } from "../lib/works/explosion";
import { browserExplosionEnv, browserSoundsEnv } from "../lib/works/browser";
import { createSounds } from "../lib/works/sounds";

const FIXTURE = readFileSync(new URL("./fixtures/works-original-explosion-enh.js", import.meta.url), "utf8");

interface Opts {
  seed?: number;
  dpr?: number | undefined;
  innerWidth?: number;
  innerHeight?: number;
  rect?: { width: number; height: number };
  hasCanvas?: boolean;
  startAt?: number;
}

const fmt = (v: unknown): string => (v !== null && typeof v === "object" && "__name" in v ? String((v as { __name: string }).__name) : String(v));

/** Recording stand-in for a canvas 2D context (any method call or property write is logged). */
function fakeCtx(note: (s: string) => void, name: string): unknown {
  const store: Record<string, unknown> = {};
  return new Proxy(store, {
    get(_t, prop) {
      if (typeof prop !== "string") return undefined;
      if (prop in store) return store[prop];
      return (...args: unknown[]) => {
        note(`${name}.${prop}(${args.map(fmt).join(",")})`);
        if (prop === "createRadialGradient") return { addColorStop: (...a: unknown[]) => note(`${name}.gradient.addColorStop(${a.map(fmt).join(",")})`) };
        return undefined;
      };
    },
    set(_t, prop, value) {
      note(`${name}.${String(prop)}=${fmt(value)}`);
      store[prop as string] = value;
      return true;
    },
  });
}

function fakeCanvas(note: (s: string) => void, name: string): ExplosionCanvas & SpriteCanvas & { __name: string } {
  const dims: Record<string, number> = { width: 0, height: 0 };
  const ctx = fakeCtx(note, `${name}.ctx`);
  const c = {
    __name: name,
    get width() { return dims.width; },
    set width(v: number) { dims.width = v; note(`${name}.width=${v}`); },
    get height() { return dims.height; },
    set height(v: number) { dims.height = v; note(`${name}.height=${v}`); },
    classList: {
      add: (...t: string[]) => note(`${name}.classList.add(${t.join(",")})`),
      remove: (...t: string[]) => note(`${name}.classList.remove(${t.join(",")})`),
    },
    getContext: (kind: string) => { note(`${name}.getContext(${kind})`); return ctx; },
  };
  return c as unknown as ExplosionCanvas & SpriteCanvas & { __name: string };
}

function world(o: Opts = {}) {
  const clock = new Clock();
  if (o.startAt) clock.advance(o.startAt);
  const log: string[] = [];
  const note = (s: string) => log.push(`@${clock.now} ${s}`);
  const rng = mulberry32(o.seed ?? 11);
  let sprites = 0;
  const canvas = o.hasCanvas === false ? null : fakeCanvas(note, "cv");
  const rect = o.rect ?? { width: 800, height: 600 };
  const innerWidth = o.innerWidth ?? 1280, innerHeight = o.innerHeight ?? 720;
  const dpr = "dpr" in o ? o.dpr : 1;
  const newSprite = () => fakeCanvas(note, `sprite#${++sprites}`);
  return { clock, log, note, rng, canvas, rect, innerWidth, innerHeight, dpr, newSprite };
}
type World = ReturnType<typeof world>;

function runOriginal(w: World): boolean {
  const M: Math = Object.create(Math);
  Object.defineProperty(M, "random", { value: w.rng });
  const win: Record<string, unknown> = { devicePixelRatio: w.dpr };
  vm.runInNewContext(`(function(){\n${FIXTURE}\n})()`, {
    window: win,
    document: { createElement: () => w.newSprite() },
    performance: { now: () => w.clock.now },
    requestAnimationFrame: w.clock.requestAnimationFrame,
    innerWidth: w.innerWidth,
    innerHeight: w.innerHeight,
    Math: M,
  });
  const cover = {
    querySelector: (sel: string) => (sel === ".explosion-3d" ? w.canvas : null),
    getBoundingClientRect: () => w.rect,
  };
  return (win.run3DExplosion as (c: unknown) => boolean)(cover);
}

function portEnv(w: World) {
  return {
    devicePixelRatio: w.dpr as number,
    innerWidth: w.innerWidth,
    innerHeight: w.innerHeight,
    now: () => w.clock.now,
    frames: { requestAnimationFrame: w.clock.requestAnimationFrame, cancelAnimationFrame: w.clock.cancelAnimationFrame },
    random: w.rng,
    createSpriteCanvas: () => w.newSprite() as SpriteCanvas,
  };
}
function runPort(w: World, env = portEnv(w)) {
  const ex = createExplosion(env);
  const used = ex.explode({ getBoundingClientRect: () => w.rect, canvas: w.canvas });
  return { used, ex };
}

function compare(o: Opts, ms = DUR + 300) {
  const a = world(o), b = world(o);
  const ra = runOriginal(a);
  const rb = runPort(b).used;
  a.clock.advance(ms);
  b.clock.advance(ms);
  same(rb, ra, "return value");
  same(b.log, a.log, "draw-call log with virtual timestamps");
  same(b.clock.pending(), a.clock.pending(), "pending frames/timers");
  return { a, b, used: rb };
}

test("DUR keeps its v4 value (enhancements.js:35)", () => {
  assert.equal(DUR, 2100);
});

test("parity: default scene (800x600, dpr 1) — identical draw calls with timestamps", () => {
  const { a, b } = compare({});
  assert.ok(a.log.length > 1000, `expected a long log, got ${a.log.length}`);
  assert.ok(b.log.some((l) => l.includes("drawImage")));
  assert.equal(b.clock.pending().frames, 0, "no frame left after the run");
});

test("parity: dpr 3 is clamped to 2; dpr 0/undefined falls back to 1; dpr 1.5 kept", () => {
  const hi = compare({ dpr: 3 });
  assert.ok(hi.b.log.some((l) => l.includes("cv.width=1600")));
  const zero = compare({ dpr: 0 });
  assert.ok(zero.b.log.some((l) => l.includes("cv.width=800")));
  const none = compare({ dpr: undefined });
  assert.ok(none.b.log.some((l) => l.includes("cv.width=800")));
  const frac = compare({ dpr: 1.5 });
  assert.ok(frac.b.log.some((l) => l.includes("cv.width=1200")));
});

test("parity: a 0-size rect falls back to the window size", () => {
  const { b } = compare({ rect: { width: 0, height: 0 }, innerWidth: 1000, innerHeight: 500 });
  assert.ok(b.log.some((l) => l.includes("cv.width=1000")) && b.log.some((l) => l.includes("cv.height=500")));
  const part = compare({ rect: { width: 640, height: 0 }, innerWidth: 1000, innerHeight: 500 });
  assert.ok(part.b.log.some((l) => l.includes("cv.width=640")) && part.b.log.some((l) => l.includes("cv.height=500")));
});

test("parity: other seeds and a clock that does not start at 0", () => {
  compare({ seed: 1 });
  compare({ seed: 987654, startAt: 1234 });
  compare({ seed: 5, startAt: 50000, dpr: 2, rect: { width: 390, height: 844 } });
});

test("no canvas: returns false and does nothing (original and port)", () => {
  const { a, b, used } = compare({ hasCanvas: false });
  assert.equal(used, false);
  assert.deepEqual(a.log, []);
  assert.deepEqual(b.log, []);
});

test("the run ends after DUR: last clearRect, 'active' removed, no frame pending", () => {
  const w = world({});
  runPort(w);
  w.clock.advance(DUR - 40);
  assert.equal(w.clock.pending().frames, 1);
  assert.ok(!w.log.some((l) => l.includes("classList.remove")));
  w.clock.advance(200);
  assert.equal(w.clock.pending().frames, 0);
  assert.ok(w.log[w.log.length - 1].includes("cv.classList.remove(active)"));
  assert.ok(w.log[w.log.length - 2].includes("cv.ctx.clearRect(0,0,800,600)"));
  assert.ok(w.log.some((l) => l.includes("cv.classList.add(active)")));
});

test("the first frame is synchronous (t = 0); one sprite pair, fire first (4 stops) then smoke (3 stops)", () => {
  const w = world({});
  runPort(w);
  const head = w.log.slice(0, 40);
  assert.ok(head.some((l) => l.startsWith("@0 cv.ctx.clearRect(0,0,800,600)")));
  const stops = w.log.filter((l) => l.includes("addColorStop"));
  assert.equal(stops.length, 7);
  assert.ok(stops[0].includes("sprite#1") && stops[4].includes("sprite#2"));
});

test("sensitivity: another random order or another dpr makes the comparison fail (guard against a vacuous test)", () => {
  const a = world({ seed: 11 }), b = world({ seed: 11 });
  runOriginal(a);
  runPort(b, { ...portEnv(b), random: mulberry32(12) });
  a.clock.advance(DUR + 300);
  b.clock.advance(DUR + 300);
  assert.notDeepEqual(b.log, a.log);

  const c = world({ dpr: 2 }), d = world({ dpr: 2 });
  runOriginal(c);
  runPort(d, { ...portEnv(d), devicePixelRatio: 1 });
  c.clock.advance(DUR + 300);
  d.clock.advance(DUR + 300);
  assert.notDeepEqual(d.log, c.log);
});

test("dispose mid-run: cancels the queued frame, clears the canvas, removes 'active'; nothing runs afterwards", () => {
  const w = world({});
  const { ex } = runPort(w);
  w.clock.advance(500);
  assert.equal(w.clock.pending().frames, 1);
  ex.dispose();
  assert.equal(w.clock.pending().frames, 0);
  const n = w.log.length;
  assert.ok(w.log[n - 1].includes("cv.classList.remove(active)"));
  assert.ok(w.log[n - 2].includes("cv.ctx.clearRect(0,0,800,600)"));
  w.clock.advance(5000);
  assert.equal(w.log.length, n, "no write after dispose");
});

test("dispose is idempotent, safe before any run and safe after a finished run; later explode draws nothing and returns false", () => {
  const w = world({});
  const ex = createExplosion(portEnv(w));
  ex.dispose();
  ex.dispose();
  const used = ex.explode({ getBoundingClientRect: () => w.rect, canvas: w.canvas });
  assert.equal(used, false);
  assert.deepEqual(w.log, []);

  const w2 = world({});
  const r = runPort(w2);
  w2.clock.advance(DUR + 100);
  const n = w2.log.length;
  r.ex.dispose();
  assert.equal(w2.log.length, n, "a finished run leaves nothing to clean");
});

test("a canvas without a 2D context returns false instead of throwing", () => {
  const w = world({});
  const cv = { width: 0, height: 0, classList: { add() {}, remove() {} }, getContext: () => null } as unknown as ExplosionCanvas;
  const ex = createExplosion(portEnv(w));
  assert.equal(ex.explode({ getBoundingClientRect: () => w.rect, canvas: cv }), false);
});

// ---------- browser adapters ----------

test("browserSoundsEnv prefers AudioContext, falls back to webkitAudioContext, throws a TypeError when neither exists", () => {
  const made: string[] = [];
  class Std { constructor() { made.push("std"); } }
  class Webkit { constructor() { made.push("webkit"); } }
  browserSoundsEnv({ AudioContext: Std, webkitAudioContext: Webkit }).createContext();
  browserSoundsEnv({ webkitAudioContext: Webkit }).createContext();
  assert.deepEqual(made, ["std", "webkit"]);
  assert.throws(() => browserSoundsEnv({}).createContext(), TypeError);
});

test("browserSoundsEnv passes the random function through; with no audio createSounds swallows the failure (v4)", () => {
  const rnd = () => 0.5;
  assert.equal(browserSoundsEnv({}, rnd).random, rnd);
  const s = createSounds(browserSoundsEnv({}));
  assert.doesNotThrow(() => { s.playTick(660); s.playBoom(); s.dispose(); });
});

test("browserExplosionEnv reads the window lazily and forwards frames, time and canvas creation", () => {
  const calls: string[] = [];
  const win = {
    devicePixelRatio: 1,
    innerWidth: 100,
    innerHeight: 50,
    performance: { now: () => 42 },
    requestAnimationFrame: (_fn: (n: number) => void) => { calls.push("raf"); return 7; },
    cancelAnimationFrame: (id: number) => { calls.push(`cancel${id}`); },
  };
  const sprite = { width: 0, height: 0, getContext: () => null };
  const env = browserExplosionEnv(win, () => sprite, () => 0.25);
  assert.equal(env.now(), 42);
  assert.equal(env.frames.requestAnimationFrame(() => {}), 7);
  env.frames.cancelAnimationFrame(7);
  assert.deepEqual(calls, ["raf", "cancel7"]);
  assert.equal(env.createSpriteCanvas(), sprite);
  assert.equal(env.random(), 0.25);
  assert.equal(env.devicePixelRatio, 1);
  (win as { devicePixelRatio: number }).devicePixelRatio = 2;
  assert.equal(env.devicePixelRatio, 2, "dpr is read at use time (window moved to another screen)");
  assert.equal(env.innerWidth, 100);
});
