// STATUS: UNVERIFIED (Claude draft; run in the cloud sandbox only, not yet on the owner's machine)
/**
 * W2 parity: lib/works/detonation.ts against the verbatim v4 block (tests/fixtures/works-original-category.js,
 * site/index.html:2451-2483 and 2561-2593), driven by the original click flow in the fake world.
 * The reveal is W7's revealProjects ("with W7"); sounds are recorded, the explosion is a stub (W6 is not decided).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { CategoryScene, audioOnly, compareRuns, notIO, same, type CategoryOpts, type Step } from "./helpers/works-harness";
import { createDetonation } from "../lib/works/detonation";
import { revealProjects } from "../lib/works/category-reveal";
import type { Detonation, DetonationEnv } from "../lib/works/contract";

const scene = (w: unknown) => w as CategoryScene;
const notAudioNotIO = (l: string) => notIO(l) && !audioOnly(l);

/** Original on A, port on B (cover click bound to detonate, one detonation per category); same click/advance steps. */
function parity(opts: CategoryOpts, steps: Step[], over: (w: CategoryScene, i: number) => Partial<DetonationEnv> = () => ({})) {
  const dets: Detonation[] = [];
  const r = compareRuns({
    make: () => new CategoryScene({ audio: "standard", ...opts }),
    original: (w) => {
      w.runOriginal();
    },
    port: (w) => {
      w.cats.forEach((c, i) => {
        const d = createDetonation(w.detonationEnv(i, { reveal: () => revealProjects(w.parts(i)), ...over(w, i) }));
        dets.push(d);
        c.cover.addEventListener("click", () => d.detonate());
      });
      return () => dets.forEach((d) => d.dispose());
    },
    only: notAudioNotIO,
    autoFrame: false,
    steps,
  });
  same(r.ported.soundLog, r.original.soundLog, "ticks and boom at the same virtual times");
  return { ...r, dets };
}
const click = (cat = 0): Step => ({ op: "click", cat });
const adv = (ms: number): Step => ({ op: "advance", ms });

test("full sequence: countdown 3-2-1, boom, flash, shake, explosion, reveal (t=4250)", () => {
  const r = parity({ cards: 3 }, [click(), adv(4300)]);
  same(r.ported.soundLog.map((e) => e.kind), ["tick", "tick", "tick", "boom"]);
  same(r.ported.soundLog.map((e) => e.t), [0, 700, 1400, 2050]);
  same(r.ported.resources().timers, 0);
});

test("the sound frequencies are 660, 740, 830", () => {
  const r = parity({}, [click(), adv(2100)]);
  same(r.ported.soundLog.filter((e) => e.kind === "tick").map((e) => (e.kind === "tick" ? e.freq : 0)), [660, 740, 830]);
});

test("timeline in small steps: every intermediate instant matches", () => {
  const steps: Step[] = [click()];
  for (let t = 0; t < 4400; t += 50) steps.push(adv(50));
  parity({ cards: 2 }, steps);
});

test("second click mid-countdown and after the reveal does nothing (done guard)", () => {
  const r = parity({}, [click(), adv(300), click(), adv(2000), click(), adv(2300), click(), adv(100)]);
  same(r.ported.soundLog.map((e) => e.kind), ["tick", "tick", "tick", "boom"]);
});

test("two categories run independently, even overlapping", () => {
  parity({ cats: ["social", "ads"], cards: 2 }, [click(0), adv(900), click(1), adv(5000)]);
});

test("missing cta, bomb, flash, projects are tolerated exactly like the original", () => {
  for (const m of ["cta", "bomb", "flash", "projects"] as const) parity({ missing: [m] }, [click(), adv(4300)]);
  parity({ missing: ["cta", "bomb", "flash", "projects"] }, [click(), adv(4300)]);
});

test("missing countdown: both throw a TypeError at the first tick, after done/cta/bomb were written", () => {
  const w = new CategoryScene({ missing: ["countdown"] });
  const det = createDetonation(w.detonationEnv(0));
  assert.throws(() => det.detonate(), { name: "TypeError" });
  same(w.cats[0].cover.dataset.done, "1");
  same(w.lines(/opacity/).length, 2);
  same(w.resources().timers, 0);
  const o = new CategoryScene({ missing: ["countdown"] });
  o.runOriginal();
  assert.throws(() => o.apply({ op: "click" }), { name: "TypeError" });
  same(o.cats[0].cover.dataset.done, "1");
  same(o.lines(/opacity/), w.lines(/opacity/));
});

test("explode returning false with no fallback: the port does nothing else (the original's DOM fallback is W3, not ported)", () => {
  const w = new CategoryScene({ explode: false });
  const det = createDetonation(w.detonationEnv(0));
  det.detonate();
  w.apply(adv(5000));
  same(w.lines(/particle|smoke|blackout/), []);
  same(w.resources().timers, 0);
});

test("explode returning false with a recording fallback: particles, blackout, then smoke 150 ms later", () => {
  const calls: string[] = [];
  const w = new CategoryScene({ explode: false });
  const det = createDetonation(
    w.detonationEnv(0, {
      fallback: { particles: () => calls.push(`particles@${w.clock.now}`), blackout: () => calls.push(`blackout@${w.clock.now}`), smoke: () => calls.push(`smoke@${w.clock.now}`) },
    }),
  );
  det.detonate();
  w.apply(adv(5000));
  same(calls, ["particles@2050", "blackout@2050", "smoke@2200"]);
});

test("explode returning true: the fallback is never called", () => {
  const calls: string[] = [];
  const w = new CategoryScene({ explode: true });
  const det = createDetonation(
    w.detonationEnv(0, { fallback: { particles: () => calls.push("p"), blackout: () => calls.push("b"), smoke: () => calls.push("s") } }),
  );
  det.detonate();
  w.apply(adv(5000));
  same(calls, []);
});

test("the injected reveal runs exactly once, at t=4250 after the click", () => {
  const w = new CategoryScene({});
  const times: number[] = [];
  const det = createDetonation(w.detonationEnv(0, { reveal: () => times.push(w.clock.now) }));
  det.detonate();
  w.apply(adv(10000));
  same(times, [4250]);
});

test("shake is removed 500 ms after the explosion (t=2550) and the explosion call happens at t=2050", () => {
  const w = new CategoryScene({});
  const det = createDetonation(w.detonationEnv(0));
  det.detonate();
  w.apply(adv(5000));
  const shake = w.lines(/cover\[0\].*shake/);
  assert.ok(shake.some((l) => l.startsWith("@2050")), shake.join("\n"));
  assert.ok(shake.some((l) => l.startsWith("@2550")), shake.join("\n"));
  assert.ok(w.lines(/explode\(/).some((l) => l.startsWith("@2050")));
});

test("dispose at several instants leaves no pending timer and no later activity", () => {
  for (const at of [0, 300, 701, 1500, 2060, 2400, 3000, 4300]) {
    const w = new CategoryScene({});
    const det = createDetonation(w.detonationEnv(0));
    det.detonate();
    if (at) w.apply(adv(at));
    det.dispose();
    same(w.resources().timers, 0, `dispose at ${at}`);
    const n = w.log.length;
    w.apply(adv(6000));
    same(w.log.length, n, `no activity after dispose at ${at}`);
  }
});

test("dispose twice and dispose without detonating are harmless", () => {
  const w = new CategoryScene({});
  const det = createDetonation(w.detonationEnv(0));
  assert.doesNotThrow(() => {
    det.dispose();
    det.dispose();
  });
});

// ---------------------------------------------------------------- mutants

/** A faithful re-implementation with one deliberate defect per knob. compareRuns must reject every knob but accept {}. */
test("mutants: 600 instead of 650, shake removal at 400 and boom before removing show are reported", () => {
  type M = { gap?: number; shake?: number; order?: boolean };
  const run = (m: M) => () =>
    compareRuns({
      make: () => new CategoryScene({ cards: 2 }),
      original: (w) => {
        w.runOriginal();
      },
      port: (w) => {
        const p = w.parts(0);
        const env = w.detonationEnv(0);
        const later = (fn: () => void, ms: number): void => {
          env.timers.setTimeout(fn, ms);
        };
        const explode = (): void => {
          env.sounds.playBoom();
          if (p.flash) {
            p.flash.classList.remove("active");
            void p.flash.offsetWidth;
            p.flash.classList.add("active");
          }
          p.cover.classList.add("shake");
          env.explode(env.explosionTarget);
          later(() => p.cover.classList.remove("shake"), m.shake ?? 500);
          later(() => revealProjects(p), 2200);
        };
        w.cats[0].cover.addEventListener("click", () => {
          if (p.cover.dataset.done) return;
          p.cover.dataset.done = "1";
          if (p.cta) p.cta.style.opacity = "0";
          if (p.bomb) p.bomb.style.opacity = "0";
          const c = p.countdown;
          if (!c) return;
          let n = 3;
          const step = (): void => {
            c.textContent = String(n);
            c.classList.add("show");
            c.classList.remove("pulse");
            void c.offsetWidth;
            c.classList.add("pulse");
            env.sounds.playTick({ 3: 660, 2: 740, 1: 830 }[n] ?? 660);
            if (n > 1) {
              n--;
              later(step, 700);
            } else {
              later(() => {
                if (m.order) {
                  explode();
                  c.classList.remove("show");
                } else {
                  c.classList.remove("show");
                  explode();
                }
              }, m.gap ?? 650);
            }
          };
          step();
        });
      },
      only: notAudioNotIO,
      autoFrame: false,
      snapshots: false,
      steps: [click(), adv(4300)],
    });
  assert.doesNotThrow(run({}), "sanity: the mutant with no defect behaves like the original");
  assert.throws(run({ gap: 600 }), /log differs/);
  assert.throws(run({ shake: 400 }), /log differs/);
  assert.throws(run({ order: true }), /log differs/);
});
