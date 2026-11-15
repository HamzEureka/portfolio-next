// STATUS: UNVERIFIED (DeepSeek draft, reviewed by Claude; independent second suite, run in the cloud sandbox only)
/**
 * W2 parity: lib/works/detonation.ts against the verbatim v4 block (site/index.html:2451-2483, 2561-2593)
 * in the fake world of tests/helpers/works-harness.ts.
 *
 * The only W7 import below is for the clearly named end-to-end reveal tests; every other test injects a
 * no-op reveal and stays inside W2's ownership.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CategoryScene,
  audioOnly,
  compareRuns,
  notIO,
  same,
  type CategoryOpts,
  type Step,
} from "./helpers/works-harness";
import { createDetonation } from "../lib/works/detonation";
import { revealProjects } from "../lib/works/category-reveal";
import type { DetonationEnv, FallbackEffects } from "../lib/works/contract";

function parity(
  opts: CategoryOpts,
  steps: Step[],
  over: (w: CategoryScene, i: number) => Partial<DetonationEnv> = () => ({}),
) {
  const r = compareRuns({
    make: () => new CategoryScene(opts),
    original: (w) => {
      w.runOriginal();
    },
    port: (w) => {
      const dets = w.cats.map((cat, i) => {
        const det = createDetonation(w.detonationEnv(i, over(w, i)));
        cat.cover.addEventListener("click", () => det.detonate());
        return det;
      });
      return () => {
        for (const det of dets) det.dispose();
      };
    },
    steps,
    only: (line) => notIO(line) && !audioOnly(line),
    autoFrame: false,
  });
  same(r.ported.soundLog, r.original.soundLog, "ticks and boom at the same virtual times");
  return r;
}

test("with W7 reveal: full sequence, second click mid-countdown and after reveal ignored", () => {
  const r = compareRuns({
    make: () => new CategoryScene({ audio: "standard", cards: 3 }),
    original: (w) => {
      w.runOriginal();
    },
    port: (w) => {
      const det = createDetonation(w.detonationEnv(0, { reveal: () => revealProjects(w.parts(0)) }));
      w.cats[0].cover.addEventListener("click", () => det.detonate());
      return () => det.dispose();
    },
    steps: [
      { op: "click" },
      { op: "advance", ms: 100 },
      { op: "click" },
      { op: "advance", ms: 2000 },
      { op: "click" },
      { op: "advance", ms: 2150 },
      { op: "click" },
      { op: "advance", ms: 1000 },
    ],
    only: (line) => notIO(line) && !audioOnly(line),
    autoFrame: false,
  });
  same(r.ported.soundLog, r.original.soundLog, "ticks and boom at the same virtual times");
  same(r.ported.soundLog.map((e) => e.kind), ["tick", "tick", "tick", "boom"]);
  same(r.ported.soundLog.map((e) => (e.kind === "tick" ? e.freq : null)), [660, 740, 830, null]);
  same(r.ported.resources().timers, 0, "no timer left after the reveal");
});

test("with W7 reveal: missing projects is skipped without error", () => {
  const r = compareRuns({
    make: () => new CategoryScene({ audio: "standard", missing: ["projects"] }),
    original: (w) => {
      w.runOriginal();
    },
    port: (w) => {
      const det = createDetonation(w.detonationEnv(0, { reveal: () => revealProjects(w.parts(0)) }));
      w.cats[0].cover.addEventListener("click", () => det.detonate());
      return () => det.dispose();
    },
    steps: [{ op: "click" }, { op: "advance", ms: 5000 }],
    only: (line) => notIO(line) && !audioOnly(line),
    autoFrame: false,
  });
  same(r.ported.soundLog, r.original.soundLog, "ticks and boom at the same virtual times");
  same(r.ported.resources().timers, 0);
});

test("two categories detonate independently; the done guard is per cover", () => {
  const r = parity(
    { audio: "standard", cats: ["social", "ads"], cards: 2 },
    [
      { op: "click", cat: 0 },
      { op: "advance", ms: 800 },
      { op: "click", cat: 1 },
      { op: "advance", ms: 1200 },
      { op: "click", cat: 0 },
      { op: "advance", ms: 1000 },
    ],
  );
  same(r.ported.soundLog.filter((e) => e.kind === "tick").length, 6);
  same(r.ported.soundLog.filter((e) => e.kind === "boom").length, 2);
});

for (const missing of ["cta", "bomb", "flash"] as const) {
  test(`missing ${missing}: skipped silently`, () => {
    parity({ audio: "standard", missing: [missing] }, [
      { op: "click" },
      { op: "advance", ms: 3000 },
    ]);
  });
}

test("missing countdown: throws TypeError after setting done and hiding cta/bomb", () => {
  const original = new CategoryScene({ missing: ["countdown"] });
  original.runOriginal();
  original.log.length = 0;
  assert.throws(() => original.apply({ op: "click" }), { name: "TypeError" });
  const originalLog = original.log.slice();

  const ported = new CategoryScene({ missing: ["countdown"] });
  const det = createDetonation(ported.detonationEnv(0));
  ported.cats[0].cover.addEventListener("click", () => det.detonate());
  ported.log.length = 0;
  assert.throws(() => ported.apply({ op: "click" }), { name: "TypeError" });

  same(ported.log, originalLog, "same writes before the throw");
  same(ported.cats[0].cover.dataset.done, "1");
  same(ported.resources().timers, 0);
  det.dispose();
});

test("explode:false with fallback null does no fallback work, but still removes shake and reveals", () => {
  const w = new CategoryScene({ audio: "standard" });
  const reveals: number[] = [];
  const det = createDetonation(
    w.detonationEnv(0, {
      fallback: null,
      explode: () => false,
      reveal: () => reveals.push(w.clock.now),
    }),
  );

  det.detonate();
  w.apply({ op: "advance", ms: 2050 });
  assert.equal(w.cats[0].cover.classList.contains("shake"), true);

  w.apply({ op: "advance", ms: 500 });
  assert.equal(w.cats[0].cover.classList.contains("shake"), false);

  w.apply({ op: "advance", ms: 1700 });
  same(reveals, [4250]);
  same(w.resources().timers, 0);
});

test("explode:false with fallback calls particles, blackout, then smoke 150 ms later", () => {
  const w = new CategoryScene({ audio: "standard" });
  const events: Array<{ t: number; kind: string }> = [];
  const fallback: FallbackEffects = {
    particles: () => events.push({ t: w.clock.now, kind: "particles" }),
    blackout: () => events.push({ t: w.clock.now, kind: "blackout" }),
    smoke: () => events.push({ t: w.clock.now, kind: "smoke" }),
  };
  const det = createDetonation(w.detonationEnv(0, { fallback, explode: () => false }));

  det.detonate();
  w.apply({ op: "advance", ms: 2050 });
  same(events, [
    { t: 2050, kind: "particles" },
    { t: 2050, kind: "blackout" },
  ]);

  w.apply({ op: "advance", ms: 150 });
  same(events, [
    { t: 2050, kind: "particles" },
    { t: 2050, kind: "blackout" },
    { t: 2200, kind: "smoke" },
  ]);

  w.apply({ op: "advance", ms: 2050 });
  same(w.resources().timers, 0);
});

test("explode:true never calls the fallback", () => {
  const w = new CategoryScene({ audio: "standard" });
  let calls = 0;
  const fallback: FallbackEffects = {
    particles: () => calls++,
    blackout: () => calls++,
    smoke: () => calls++,
  };
  const det = createDetonation(w.detonationEnv(0, { fallback, explode: () => true }));

  det.detonate();
  w.apply({ op: "advance", ms: 5000 });
  same(calls, 0);
  same(w.resources().timers, 0);
});

test("reveal is scheduled 2200 ms after the boom, i.e. 4250 ms after the click", () => {
  const w = new CategoryScene({ audio: "standard" });
  const times: number[] = [];
  const det = createDetonation(w.detonationEnv(0, { reveal: () => times.push(w.clock.now) }));

  det.detonate();
  w.apply({ op: "advance", ms: 4249 });
  same(times, []);

  w.apply({ op: "advance", ms: 1 });
  same(times, [4250]);
  same(w.resources().timers, 0);
});

test("dispose clears pending timers at any instant and is idempotent", () => {
  for (const at of [0, 750, 2100, 5000]) {
    const w = new CategoryScene({ audio: "standard" });
    const det = createDetonation(w.detonationEnv(0));

    det.detonate();
    if (at > 0) w.apply({ op: "advance", ms: at });

    det.dispose();
    same(w.resources().timers, 0, `no timers after dispose at ${at}`);

    w.log.length = 0;
    w.soundLog.length = 0;
    w.apply({ op: "advance", ms: 10000 });
    same(w.log, [], `no further log lines after dispose at ${at}`);
    same(w.soundLog, [], `no further sounds after dispose at ${at}`);
    assert.doesNotThrow(() => det.dispose());
  }
});

test("dispose without detonating is harmless; detonate after dispose is a no-op", () => {
  const w = new CategoryScene({ audio: "standard" });
  const det = createDetonation(w.detonationEnv(0));

  det.dispose();
  same(w.resources().timers, 0);

  w.log.length = 0;
  det.detonate();
  same(w.log, [], "detonate after dispose writes nothing");
  same(w.resources().timers, 0);

  w.apply({ op: "advance", ms: 10000 });
  same(w.log, []);
  assert.doesNotThrow(() => det.dispose());
});

test("dispose clears the pending fallback smoke timer too", () => {
  const w = new CategoryScene({ audio: "standard" });
  const events: string[] = [];
  const fallback: FallbackEffects = {
    particles: () => {},
    blackout: () => {},
    smoke: () => events.push("smoke"),
  };
  const det = createDetonation(w.detonationEnv(0, { fallback, explode: () => false }));

  det.detonate();
  w.apply({ op: "advance", ms: 2050 });
  assert.ok(w.resources().timers > 0);

  det.dispose();
  w.apply({ op: "advance", ms: 1000 });
  same(events, []);
});

/** A deliberately wrong port; each knob breaks one thing the real port must keep. */
function mutantDetonation(
  w: CategoryScene,
  m: { explosionDelay?: number; shakeDelay?: number; runBeforeHide?: boolean },
) {
  const env = w.detonationEnv(0, { reveal: () => {} });
  const { parts, timers, sounds, explode, explosionTarget, fallback } = env;
  const pending = new Set<number>();

  const schedule = (fn: () => void, ms: number): void => {
    const id = timers.setTimeout(fn, ms);
    pending.add(id);
  };

  const detonate = (): void => {
    const cover = parts.cover;
    if (cover.dataset.done) return;
    cover.dataset.done = "1";

    if (parts.cta) parts.cta.style.opacity = "0";
    if (parts.bomb) parts.bomb.style.opacity = "0";

    let n = 3;

    const runExplosion = (): void => {
      sounds.playBoom();
      const flash = parts.flash;
      if (flash) {
        flash.classList.remove("active");
        void flash.offsetWidth;
        flash.classList.add("active");
      }
      cover.classList.add("shake");

      const used = explode(explosionTarget);
      if (!used && fallback) {
        fallback.particles();
        fallback.blackout();
        schedule(() => fallback.smoke(), 150);
      }
      schedule(() => cover.classList.remove("shake"), m.shakeDelay ?? 500);
      schedule(() => env.reveal(), 2200);
    };

    const tickStep = (): void => {
      const countdown = parts.countdown;
      if (!countdown) throw new TypeError("countdown");
      countdown.textContent = String(n);
      countdown.classList.add("show");
      countdown.classList.remove("pulse");
      void countdown.offsetWidth;
      countdown.classList.add("pulse");
      sounds.playTick({ 3: 660, 2: 740, 1: 830 }[n] || 660);

      if (n > 1) {
        n--;
        schedule(tickStep, 700);
      } else {
        schedule(() => {
          if (m.runBeforeHide) {
            runExplosion();
            countdown.classList.remove("show");
          } else {
            countdown.classList.remove("show");
            runExplosion();
          }
        }, m.explosionDelay ?? 650);
      }
    };

    tickStep();
  };

  return {
    detonate,
    dispose: () => {
      for (const id of pending) timers.clearTimeout(id);
      pending.clear();
    },
  };
}

function runMutant(
  m: Parameters<typeof mutantDetonation>[1],
  steps: Step[],
) {
  return () =>
    compareRuns({
      make: () => new CategoryScene({ audio: "standard", cards: 3 }),
      original: (w) => {
        w.runOriginal();
      },
      port: (w) => {
        const det = mutantDetonation(w, m);
        w.cats[0].cover.addEventListener("click", () => det.detonate());
        return () => det.dispose();
      },
      steps,
      only: (line) => notIO(line) && !audioOnly(line),
      autoFrame: false,
    });
}

test("mutants: wrong explosion delay, wrong shake removal, run-before-hide are rejected", () => {
  const steps: Step[] = [
    { op: "click" },
    { op: "advance", ms: 2000 },
    { op: "advance", ms: 50 },
    { op: "advance", ms: 400 },
  ];

  assert.doesNotThrow(runMutant({}, steps), "sanity: a defect-free mutant matches the original");
  assert.throws(runMutant({ explosionDelay: 600 }, steps), /log differs/);
  assert.throws(runMutant({ shakeDelay: 400 }, steps), /log differs/);
  assert.throws(runMutant({ runBeforeHide: true }, steps), /log differs/);
});
