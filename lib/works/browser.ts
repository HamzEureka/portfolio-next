// STATUS: UNVERIFIED (Claude draft; M3/T5; types checked with stubs in the cloud sandbox, never run in a browser)
/**
 * Browser adapters for the injected envs of lib/works (client components only; call inside an effect, never during SSR).
 * Real objects are handed over through minimal structural types so the modules and their tests never import DOM globals.
 */
import type { AudioContextLike, SoundsEnv } from "./contract";
import type { ExplosionEnv, SpriteCanvas } from "./explosion";

/** The two constructors v4 looks for: `new (window.AudioContext || window.webkitAudioContext)()` (index.html:2360). */
export interface AudioWindow {
  AudioContext?: new () => unknown;
  webkitAudioContext?: new () => unknown;
}

/**
 * Real AudioContext adapter for createSounds. When neither constructor exists `new undefined` throws a TypeError, which
 * createSounds swallows exactly like v4 (sound silently skipped, retried on the next call).
 */
export function browserSoundsEnv(win: AudioWindow, random: () => number = Math.random): SoundsEnv {
  return {
    createContext: () => {
      const Ctor = (win.AudioContext || win.webkitAudioContext) as new () => unknown;
      return new Ctor() as AudioContextLike;
    },
    random,
  };
}

export interface ExplosionWindow {
  readonly devicePixelRatio: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  requestAnimationFrame(fn: (now: number) => void): number;
  cancelAnimationFrame(id: number): void;
  readonly performance: { now(): number };
}

/** Real objects for createExplosion: `win` = window, `createCanvas` = () => document.createElement("canvas"). */
export function browserExplosionEnv(win: ExplosionWindow, createCanvas: () => unknown, random: () => number = Math.random): ExplosionEnv {
  return {
    get devicePixelRatio() { return win.devicePixelRatio; },
    get innerWidth() { return win.innerWidth; },
    get innerHeight() { return win.innerHeight; },
    now: () => win.performance.now(),
    frames: {
      requestAnimationFrame: (fn) => win.requestAnimationFrame(fn),
      cancelAnimationFrame: (id) => win.cancelAnimationFrame(id),
    },
    random,
    createSpriteCanvas: () => createCanvas() as SpriteCanvas,
  };
}
