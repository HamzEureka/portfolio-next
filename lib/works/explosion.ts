// STATUS: UNVERIFIED (Claude draft; M3/T5; compared with the v4 fixture in the cloud sandbox only, not yet on the owner's machine)
/**
 * T5 (D18): port of v4 `explode2D` ONLY (Canvas 2D), v4 js/enhancements.js:19-63. Nothing else from that file
 * (Three.js version, DOM particles, smoke, blackout) is ported; no `window.run3DExplosion`.
 *
 * QUIRKS preserved:
 * - `DUR = 2100`; per-FRAME physics (not per time), so the look depends on the display frame rate.
 * - The first frame runs synchronously at `t = 0`; the following frames come from requestAnimationFrame timestamps.
 * - Random call ORDER is part of the behaviour (200 fire sprites: angle, speed, radius, life; 36 smoke: x, y, vx, vy, radius, delay).
 * - dpr = min(devicePixelRatio || 1, 2); size = cover rect, or the window size when the rect is 0.
 * - Returns false only when the cover has no canvas.
 * - Canvas colors ('#ffd9a0' and the sprite gradient stops) are v4 draw-time constants, copied as is (fidelity, D18).
 *
 * DEVIATIONS (intentional):
 * - Every browser capability is injected (ExplosionEnv), as in lib/works/contract.ts.
 * - `dispose()` is new (React unmount): cancels a queued frame and, if a run is in flight, clears the canvas and removes
 *   "active". Idempotent. After it `explode` draws nothing and returns false. The original has no teardown.
 * - A canvas whose 2D context is null returns false (the original would throw). Cannot happen in a browser.
 */
import type { ClassListLike, ExplosionFn, ExplosionTarget, FrameApi } from "./contract";

// SOURCE: enhancements.js:35
export const DUR = 2100;

export interface GradientLike {
  addColorStop(offset: number, color: string): void;
}
export interface SpriteContext {
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): GradientLike;
  fillStyle: unknown;
  fillRect(x: number, y: number, w: number, h: number): void;
}
export interface SpriteCanvas {
  width: number;
  height: number;
  getContext(kind: "2d"): SpriteContext | null;
}
export interface DrawContext {
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  arc(x: number, y: number, r: number, start: number, end: number): void;
  stroke(): void;
  drawImage(image: SpriteCanvas, x: number, y: number, w: number, h: number): void;
  globalCompositeOperation: string;
  globalAlpha: number;
  lineWidth: number;
  strokeStyle: unknown;
}
/** The `.explosion-3d` canvas of the cover. */
export interface ExplosionCanvas {
  width: number;
  height: number;
  readonly classList: ClassListLike;
  getContext(kind: "2d"): DrawContext | null;
}

export interface ExplosionEnv {
  readonly devicePixelRatio: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  /** performance.now() */
  now(): number;
  frames: FrameApi;
  /** Math.random */
  random(): number;
  /** document.createElement("canvas") */
  createSpriteCanvas(): SpriteCanvas;
}

interface Fire { x: number; y: number; vx: number; vy: number; r: number; max: number }
interface Smoke { x: number; y: number; vx: number; vy: number; r: number; delay: number }

export interface Explosion {
  /** Original `explode2D(cover)`: `target.canvas` must be the cover's `.explosion-3d` canvas (or null). */
  explode: ExplosionFn;
  dispose(): void;
}

export function createExplosion(env: ExplosionEnv): Explosion {
  let disposed = false;
  let frameId: number | null = null;
  let active: { ctx: DrawContext; cv: ExplosionCanvas; W: number; H: number } | null = null;

  // SOURCE: enhancements.js:20-24
  const sprite = (stops: Array<[number, string]>): SpriteCanvas | null => {
    const s = env.createSpriteCanvas();
    s.width = s.height = 64;
    const g = s.getContext("2d");
    if (!g) return null;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    stops.forEach((st) => gr.addColorStop(st[0], st[1]));
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return s;
  };

  // SOURCE: enhancements.js:25-62
  const explode: ExplosionFn = (target: ExplosionTarget): boolean => {
    const cv = target.canvas as ExplosionCanvas | null;
    if (!cv) return false;
    if (disposed) return false;
    const dpr = Math.min(env.devicePixelRatio || 1, 2);
    const r = target.getBoundingClientRect();
    const W = r.width || env.innerWidth;
    const H = r.height || env.innerHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
    const ctx = cv.getContext("2d");
    if (!ctx) return false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fire = sprite([[0, "rgba(255,255,255,1)"], [0.3, "rgba(255,205,90,1)"], [0.6, "rgba(255,100,20,.8)"], [1, "rgba(255,60,0,0)"]]);
    const smoke = sprite([[0, "rgba(150,145,158,.9)"], [0.5, "rgba(95,90,102,.5)"], [1, "rgba(60,56,66,0)"]]);
    if (!fire || !smoke) return false;
    const cx = W / 2, cy = H / 2;
    const P: Fire[] = [], S: Smoke[] = [];
    for (let i = 0; i < 200; i++) {
      const a = env.random() * 6.283, sp = 2 + env.random() * 9;
      P.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8, r: 10 + env.random() * 22, max: 600 + env.random() * 500 });
    }
    for (let i = 0; i < 36; i++) {
      S.push({
        x: cx + (env.random() - 0.5) * 160, y: cy + (env.random() - 0.3) * 80,
        vx: (env.random() - 0.5) * 1.2, vy: -0.4 - env.random() * 1.1, r: 50 + env.random() * 60, delay: env.random() * 250,
      });
    }
    cv.classList.add("active");
    const t0 = env.now();
    active = { ctx, cv, W, H };

    const frame = (now: number): void => {
      frameId = null;
      if (disposed) return;
      const t = now - t0;
      ctx.clearRect(0, 0, W, H);
      const k = Math.min(1, t / 700); // shockwave ring
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.lineWidth = 1 + 6 * (1 - k);
      ctx.strokeStyle = "#ffd9a0";
      ctx.beginPath();
      ctx.arc(cx, cy, k * Math.min(W, H) * 0.45, 0, 6.283);
      ctx.stroke();
      S.forEach((s) => { // smoke
        if (t < s.delay) return;
        const q = (t - s.delay) / (DUR - s.delay);
        if (q > 1) return;
        s.x += s.vx;
        s.y += s.vy;
        const rr = s.r * (1 + q * 1.6);
        ctx.globalAlpha = Math.min(1, q * 4) * (1 - q) * 0.85;
        ctx.drawImage(smoke, s.x - rr, s.y - rr, rr * 2, rr * 2);
      });
      ctx.globalCompositeOperation = "lighter"; // fire
      P.forEach((p) => {
        if (t > p.max) return;
        const q = t / p.max;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.vy += 0.06;
        p.x += p.vx;
        p.y += p.vy;
        const rr = p.r * (1 - q * 0.6);
        ctx.globalAlpha = 1 - q;
        ctx.drawImage(fire, p.x - rr, p.y - rr, rr * 2, rr * 2);
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      if (t < DUR) frameId = env.frames.requestAnimationFrame(frame);
      else {
        ctx.clearRect(0, 0, W, H);
        cv.classList.remove("active");
        active = null;
      }
    };
    frame(t0);
    return true;
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    if (frameId !== null) {
      env.frames.cancelAnimationFrame(frameId);
      frameId = null;
    }
    if (active) {
      active.ctx.clearRect(0, 0, active.W, active.H);
      active.cv.classList.remove("active");
      active = null;
    }
  };

  return { explode, dispose };
}
