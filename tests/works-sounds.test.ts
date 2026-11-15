// STATUS: UNVERIFIED (Claude draft; run in the cloud sandbox only, not yet on the owner's machine)
/**
 * W4 parity: lib/works/sounds.ts against the verbatim v4 block (tests/fixtures/works-original-category.js,
 * site/index.html:2359-2407): playTick / playBoom are called on the original through a footer and on the port,
 * and every call on the fake Web Audio nodes is compared.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { CategoryScene, audioOnly, compareRuns, same, type AudioMode, type OriginalCategory, type Step } from "./helpers/works-harness";
import { createSounds } from "../lib/works/sounds";
import type { Sounds } from "../lib/works/contract";

const MODES: AudioMode[] = ["standard", "webkit", "suspended", "none", "throws"];

function sounds(audio: AudioMode, steps: (orig: () => OriginalCategory, port: () => Sounds) => Step[], seed = 7) {
  let orig: OriginalCategory | undefined;
  let s: Sounds | undefined;
  const r = compareRuns({
    make: () => new CategoryScene({ audio, seed }),
    original: (w) => {
      orig = w.runOriginal();
    },
    port: (w) => {
      s = createSounds(w.soundsEnv());
      return () => s?.dispose();
    },
    only: audioOnly,
    autoFrame: false,
    steps: steps(
      () => orig as OriginalCategory,
      () => s as Sounds,
    ),
  });
  same(r.ported.soundLog, r.original.soundLog, `${audio}: soundLog`);
  return r;
}
const tick = (f: number): ((o: () => OriginalCategory, p: () => Sounds) => Step) => (o, p) => ({ op: "do", label: `tick ${f}`, original: () => o().playTick(f), ported: () => p().playTick(f) });
const boom = (o: () => OriginalCategory, p: () => Sounds): Step => ({ op: "do", label: "boom", original: () => o().playBoom(), ported: () => p().playBoom() });

for (const mode of MODES) {
  test(`parity in audio mode "${mode}": ticks and boom with time passing`, () => {
    const r = sounds(mode, (o, p) => [tick(660)(o, p), { op: "advance", ms: 700 }, tick(740)(o, p), { op: "advance", ms: 700 }, tick(830)(o, p), { op: "advance", ms: 650 }, boom(o, p)]);
    if (mode === "standard" || mode === "webkit" || mode === "suspended") {
      same(r.ported.soundLog.map((e) => e.kind), ["tick", "tick", "tick", "boom"]);
      same(r.ported.soundLog.filter((e) => e.kind === "tick").map((e) => (e.kind === "tick" ? e.freq : 0)), [660, 740, 830]);
    } else {
      same(r.ported.soundLog, [], "no sound can be played");
    }
  });
}

test("a boom before any tick creates the context; one context is reused afterwards", () => {
  const r = sounds("standard", (o, p) => [boom(o, p), tick(660)(o, p), boom(o, p)]);
  same(r.ported.audioContexts.length, 1);
  same(r.original.audioContexts.length, 1);
});

test("a context that cannot be created is attempted again on every call and never propagates", () => {
  const r = sounds("throws", (o, p) => [tick(660)(o, p), tick(740)(o, p), boom(o, p), tick(830)(o, p)]);
  same(r.ported.audioContexts.length, r.original.audioContexts.length);
});

test("a suspended context is resumed on every sound", () => {
  const r = sounds("suspended", (o, p) => [tick(660)(o, p), tick(740)(o, p), boom(o, p)]);
  assert.ok(r.ported.lines(/resume/).length >= 1);
  same(r.ported.lines(/resume/), r.original.lines(/resume/));
});

test("the boom noise buffer has 26460 samples and the same seeded content as the original", () => {
  const r = sounds("standard", (o, p) => [boom(o, p)], 99);
  const buf = r.ported.lines(/createBuffer/);
  assert.ok(buf.some((l) => l.includes("26460")), buf.join("\n"));
  same(buf, r.original.lines(/createBuffer/));
  same(r.ported.lines(/checksum/), r.original.lines(/checksum/));
});

test("different seeds change the buffer checksum (the checksum is really compared)", () => {
  const a = sounds("standard", (o, p) => [boom(o, p)], 1);
  const b = sounds("standard", (o, p) => [boom(o, p)], 2);
  assert.notDeepEqual(a.ported.log, b.ported.log);
});

test("dispose closes the context once; later sounds do nothing and create no context", () => {
  const w = new CategoryScene({ audio: "standard" });
  const s = createSounds(w.soundsEnv());
  s.playTick(660);
  same(w.resources().audioContexts, 1);
  s.dispose();
  s.dispose();
  same(w.resources().audioClosed, 1);
  const n = w.log.length;
  s.playTick(740);
  s.playBoom();
  same(w.log.length, n);
  same(w.resources().audioContexts, 1);
});

test("dispose before any sound is a no-op and later sounds stay silent", () => {
  const w = new CategoryScene({ audio: "standard" });
  const s = createSounds(w.soundsEnv());
  s.dispose();
  s.playBoom();
  same(w.resources().audioContexts, 0);
  same(w.log, []);
});

test("dispose with a context that cannot be created or an unsupported browser does not throw", () => {
  for (const audio of ["throws", "none"] as const) {
    const w = new CategoryScene({ audio });
    const s = createSounds(w.soundsEnv());
    s.playTick(660);
    assert.doesNotThrow(() => s.dispose());
  }
});

test("dispose swallows a close() that throws or rejects", () => {
  const ctx = {
    state: "running",
    currentTime: 0,
    sampleRate: 44100,
    destination: { connect: (d: unknown) => d },
    resume: () => undefined,
    close: () => {
      throw new Error("boom");
    },
  } as unknown as ReturnType<ReturnType<typeof Object>>;
  const s = createSounds({ createContext: () => ctx as never, random: () => 0.5 });
  s.playTick(660);
  assert.doesNotThrow(() => s.dispose());
  const rejecting = { ...(ctx as object), close: () => Promise.reject(new Error("x")) };
  const s2 = createSounds({ createContext: () => rejecting as never, random: () => 0.5 });
  s2.playTick(660);
  assert.doesNotThrow(() => s2.dispose());
});

// ---------------------------------------------------------------- mutants

test("mutants: wrong ramp target, tick through setValueAtTime and missing resume are reported", () => {
  type M = { ramp?: number; tickSet?: boolean; resume?: boolean };
  const run = (m: M) => () =>
    compareRuns({
      make: () => new CategoryScene({ audio: "suspended", seed: 3 }),
      original: (w) => {
        const o = w.runOriginal();
        o.playTick(660);
      },
      port: (w) => {
        const c = w.soundsEnv().createContext();
        if (c.state === "suspended" && m.resume !== false) c.resume();
        const o = c.createOscillator(), g = c.createGain();
        o.type = "sine";
        if (m.tickSet) o.frequency.setValueAtTime(660, 0);
        else o.frequency.value = 660;
        g.gain.setValueAtTime(0.18, c.currentTime);
        g.gain.exponentialRampToValueAtTime(m.ramp ?? 0.001, c.currentTime + 0.16);
        o.connect(g).connect(c.destination);
        o.start();
        o.stop(c.currentTime + 0.16);
      },
      only: audioOnly,
      steps: [],
    });
  assert.doesNotThrow(run({}), "sanity: the mutant with no defect behaves like the original");
  assert.throws(run({ ramp: 0.01 }), /log differs/);
  assert.throws(run({ tickSet: true }), /log differs/);
  assert.throws(run({ resume: false }), /log differs/);
});
