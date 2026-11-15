// STATUS: UNVERIFIED (DeepSeek draft, reviewed by Claude; independent second suite, run in the cloud sandbox only)
/**
 * W4 parity: lib/works/sounds.ts against the verbatim v4 category fixture
 * (tests/fixtures/works-original-category.js, site/index.html:2359-2407).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CategoryScene,
  audioOnly,
  compareRuns,
  same,
  type OriginalCategory,
  type Step,
} from "./helpers/works-harness";
import type { AudioContextLike, Sounds } from "../lib/works/contract";
import { createSounds } from "../lib/works/sounds";

type AudioMode = "standard" | "webkit" | "suspended" | "none" | "throws";
const AUDIO_MODES: readonly AudioMode[] = ["standard", "webkit", "suspended", "none", "throws"];

interface Holder {
  orig: OriginalCategory | null;
  sounds: Sounds | null;
}

function tick(h: Holder, freq: number): Step {
  return {
    op: "do",
    label: `tick ${freq}`,
    original: () => {
      if (!h.orig) throw new Error("original not mounted");
      h.orig.playTick(freq);
    },
    ported: () => {
      if (!h.sounds) throw new Error("port not mounted");
      h.sounds.playTick(freq);
    },
  };
}

function boom(h: Holder): Step {
  return {
    op: "do",
    label: "boom",
    original: () => {
      if (!h.orig) throw new Error("original not mounted");
      h.orig.playBoom();
    },
    ported: () => {
      if (!h.sounds) throw new Error("port not mounted");
      h.sounds.playBoom();
    },
  };
}

test("all five audio modes: ticks and booms match the original, context is reused", () => {
  for (const audio of AUDIO_MODES) {
    const h: Holder = { orig: null, sounds: null };
    const steps: Step[] = [
      tick(h, 660),
      { op: "advance", ms: 100 },
      tick(h, 740),
      { op: "advance", ms: 700 },
      tick(h, 830),
      { op: "advance", ms: 650 },
      boom(h),
      { op: "advance", ms: 50 },
      boom(h),
    ];
    const r = compareRuns({
      make: () => new CategoryScene({ audio, seed: 7 }),
      original: (w) => { h.orig = w.runOriginal(); },
      port: (w) => { h.sounds = createSounds(w.soundsEnv()); },
      only: audioOnly,
      autoFrame: false,
      steps,
    });
    same(r.ported.soundLog, r.original.soundLog, `${audio}: soundLog`);
    same(r.ported.audioContexts.length, r.original.audioContexts.length, `${audio}: context count`);
  }
});

test("a boom before any tick creates the context and matches the original", () => {
  for (const audio of AUDIO_MODES) {
    const h: Holder = { orig: null, sounds: null };
    const steps: Step[] = [
      boom(h),
      { op: "advance", ms: 50 },
      tick(h, 660),
      { op: "advance", ms: 700 },
      boom(h),
    ];
    const r = compareRuns({
      make: () => new CategoryScene({ audio, seed: 11 }),
      original: (w) => { h.orig = w.runOriginal(); },
      port: (w) => { h.sounds = createSounds(w.soundsEnv()); },
      only: audioOnly,
      autoFrame: false,
      steps,
    });
    same(r.ported.soundLog, r.original.soundLog, `${audio}: soundLog`);
    same(r.ported.audioContexts.length, r.original.audioContexts.length, `${audio}: context count`);
  }
});

test("audio 'throws': every sound swallows the constructor error and plays nothing", () => {
  const h: Holder = { orig: null, sounds: null };
  const steps: Step[] = [
    tick(h, 660),
    { op: "advance", ms: 100 },
    boom(h),
    { op: "advance", ms: 700 },
    tick(h, 740),
    { op: "advance", ms: 650 },
    boom(h),
  ];
  const r = compareRuns({
    make: () => new CategoryScene({ audio: "throws", seed: 3 }),
    original: (w) => { h.orig = w.runOriginal(); },
    port: (w) => { h.sounds = createSounds(w.soundsEnv()); },
    only: audioOnly,
    autoFrame: false,
    steps,
  });
  same(r.ported.soundLog, []);
  same(r.original.soundLog, []);
  same(r.ported.audioContexts.length, 0);
  same(r.original.audioContexts.length, 0);
});

test("createContext is retried after a throw, and dispose stops future attempts", () => {
  let attempts = 0;
  const env = {
    createContext: (): AudioContextLike => {
      attempts++;
      throw new Error("no audio");
    },
    random: () => 0.5,
  };
  const s = createSounds(env);
  assert.doesNotThrow(() => {
    s.playTick(660);
    s.playBoom();
    s.playTick(740);
  });
  assert.equal(attempts, 3);
  s.dispose();
  s.playTick(830);
  assert.equal(attempts, 3);
});

test("dispose closes the context once, is idempotent, and later sounds are no-ops", () => {
  const w = new CategoryScene({ audio: "standard", seed: 2 });
  const s = createSounds(w.soundsEnv());
  s.playTick(660);
  same(w.resources().audioClosed, 0);
  s.dispose();
  same(w.resources().audioClosed, 1);
  s.dispose();
  same(w.resources().audioClosed, 1);

  const contexts = w.audioContexts.length;
  w.log.length = 0;
  s.playTick(740);
  s.playBoom();
  same(w.log, []);
  same(w.audioContexts.length, contexts);
});

test("dispose before any sound creates and closes nothing, and calling it twice is harmless", () => {
  const w = new CategoryScene({ audio: "standard", seed: 4 });
  const s = createSounds(w.soundsEnv());
  s.dispose();
  s.dispose();
  same(w.resources().audioClosed, 0);
  same(w.audioContexts.length, 0);
  w.log.length = 0;
  s.playTick(660);
  same(w.log, []);
  same(w.audioContexts.length, 0);
});

type MutantKind = "ramp-target" | "tick-set-value" | "no-resume";

function mutantSounds(w: CategoryScene, kind: MutantKind): Sounds {
  const env = w.soundsEnv();
  let ctx: AudioContextLike | null = null;
  let disposed = false;

  const get = (): AudioContextLike => {
    if (!ctx) ctx = env.createContext();
    if (kind !== "no-resume" && ctx.state === "suspended") ctx.resume();
    return ctx;
  };

  const playTick = (freq: number): void => {
    if (disposed) return;
    try {
      const c = get();
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine";
      if (kind === "tick-set-value") o.frequency.setValueAtTime(freq, c.currentTime);
      else o.frequency.value = freq;
      g.gain.setValueAtTime(0.18, c.currentTime);
      g.gain.exponentialRampToValueAtTime(
        kind === "ramp-target" ? 0.002 : 0.001,
        c.currentTime + 0.16,
      );
      o.connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.16);
    } catch {}
  };

  const playBoom = (): void => {
    if (disposed) return;
    try {
      const c = get();
      const bufferSize = Math.floor(c.sampleRate * 0.6);
      const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (env.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
      }
      const noise = c.createBufferSource(); noise.buffer = buffer;
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(3200, c.currentTime);
      filter.frequency.exponentialRampToValueAtTime(90, c.currentTime + 0.6);
      const noiseGain = c.createGain();
      noiseGain.gain.setValueAtTime(0.9, c.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.6);
      noise.connect(filter).connect(noiseGain).connect(c.destination);
      noise.start();

      const o = c.createOscillator(), og = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(140, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(28, c.currentTime + 0.5);
      og.gain.setValueAtTime(0.9, c.currentTime);
      og.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
      o.connect(og).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.5);
    } catch {}
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    if (!ctx) return;
    const c = ctx;
    ctx = null;
    try { c.close(); } catch {}
  };

  return { playTick, playBoom, dispose };
}

function runMutant(
  kind: MutantKind,
  audio: AudioMode,
  buildSteps: (h: Holder) => Step[],
): () => void {
  return () => {
    const h: Holder = { orig: null, sounds: null };
    const steps = buildSteps(h);
    compareRuns({
      make: () => new CategoryScene({ audio, seed: 13 }),
      original: (w) => { h.orig = w.runOriginal(); },
      port: (w) => { h.sounds = mutantSounds(w, kind); },
      only: audioOnly,
      autoFrame: false,
      steps,
    });
  };
}

test("mutants: wrong ramp target, tick setValueAtTime and missing suspended resume are rejected", () => {
  assert.throws(
    runMutant("ramp-target", "standard", (h) => [
      tick(h, 660),
      { op: "advance", ms: 100 },
      tick(h, 740),
    ]),
    /log differs/,
  );
  assert.throws(
    runMutant("tick-set-value", "standard", (h) => [tick(h, 660)]),
    /log differs/,
  );
  assert.throws(
    runMutant("no-resume", "suspended", (h) => [tick(h, 660), boom(h)]),
    /log differs/,
  );
});
