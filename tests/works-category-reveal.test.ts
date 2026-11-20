// STATUS: UNVERIFIED (Claude draft; run in the cloud sandbox only, not yet on the owner's machine)
/**
 * W7 parity: lib/works/category-reveal.ts against the verbatim v4 block (tests/fixtures/works-original-category.js,
 * site/index.html:2358-2629): the observer, resetCategory (called directly through a footer) and the reveal
 * (reached through the original click flow).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { CategoryScene, compareRuns, notIO, same, touching, type CategoryOpts, type OriginalCategory, type Step } from "./helpers/works-harness";
import { mountSectionReset, resetCategory, revealProjects } from "../lib/works/category-reveal";

const scene = (w: unknown) => w as CategoryScene;

// ---------------------------------------------------------------- observer

function observerParity(opts: CategoryOpts, steps: Step[]) {
  const r = compareRuns({
    make: () => new CategoryScene(opts),
    original: (w) => {
      w.runOriginal();
    },
    port: (w) => mountSectionReset(w.sectionResetEnv()),
    steps,
    only: notIO,
  });
  return r;
}
const done = (cat: number): Step => ({ op: "do", label: `mark ${cat} done`, original: (w) => scene(w).markDone(cat), ported: (w) => scene(w).markDone(cat) });
const io = (cat: number, isIntersecting: boolean, top: number): Step => ({ op: "io", cat, isIntersecting, top });

test("observer: one live observer with threshold 0, observing every section in order", () => {
  const w = new CategoryScene({ cats: ["social", "ads", "web"] });
  mountSectionReset(w.sectionResetEnv());
  same(w.observers.length, 1);
  same(w.observers[0].init, { threshold: 0 });
  same(w.observers[0].targets, w.cats.map((c) => c.section));
  same(w.resources().observersLive, 1);
});

test("observer: zero sections still creates the observer", () => {
  const w = new CategoryScene({});
  const unmount = mountSectionReset({ sections: [], createObserver: w.sectionResetEnv().createObserver });
  same(w.observers.length, 1);
  same(w.observers[0].targets.length, 0);
  unmount();
  same(w.resources().observersLive, 0);
});

test("observer: a category that is not detonated is never reset", () => {
  observerParity({}, [io(0, false, 100), io(0, true, 100), io(0, false, 5)]);
});

test("observer: detonated + still intersecting: no reset", () => {
  const r = observerParity({}, [done(0), io(0, true, 100), io(0, true, -50)]);
  same(r.ported.lines(/display/).length, 0);
});

test("observer: detonated + left through the BOTTOM (top > 0): reset", () => {
  const r = observerParity({}, [done(0), io(0, false, 100)]);
  assert.ok(r.ported.lines(/dataset|display|opacity/).length > 0, "something was reset");
});

test("observer: detonated + left through the TOP (top <= 0): no reset (0 and negative)", () => {
  const r = observerParity({}, [done(0), io(0, false, 0), io(0, false, -1), io(0, false, -900)]);
  same(r.ported.lines(/display/).length, 0);
});

test("observer: after a reset further events do nothing (done is '')", () => {
  const r = observerParity({}, [done(0), io(0, false, 100)]);
  const n = r.ported.log.length;
  r.ported.apply(io(0, false, 100));
  r.original.apply(io(0, false, 100));
  same(r.ported.log.length, n);
});

test("observer: categories are independent", () => {
  observerParity({ cats: ["social", "ads", "web"] }, [done(0), done(2), io(1, false, 100), io(2, false, 100), io(0, true, 10), io(0, false, 100)]);
});

test("observer: every element missing in turn, reset still matches", () => {
  for (const missing of [["cta"], ["bomb"], ["countdown"], ["projects"], ["cta", "bomb", "countdown", "projects"]] as const) {
    observerParity({ missing: [...missing] }, [done(0), io(0, false, 100)]);
  }
});

test("observer: a section whose cover is absent, an unknown target and several entries are ignored safely", () => {
  const w = new CategoryScene({ cats: ["social", "ads"] });
  const env = w.sectionResetEnv();
  mountSectionReset({ sections: [env.sections[0], { target: env.sections[1].target, parts: null }], createObserver: env.createObserver });
  w.markDone(0);
  const unknown = {};
  assert.doesNotThrow(() => {
    w.observers[0].callback([
      { target: unknown, isIntersecting: false, boundingClientRect: { top: 10 } },
      { target: w.cats[1].section, isIntersecting: false, boundingClientRect: { top: 10 } },
      { target: w.cats[0].section, isIntersecting: false, boundingClientRect: { top: 10 } },
    ]);
  });
  same(w.cats[0].cover.dataset.done, "");
});

test("observer: unmount disconnects, twice is harmless", () => {
  const w = new CategoryScene({});
  const unmount = mountSectionReset(w.sectionResetEnv());
  same(w.resources().observersLive, 1);
  unmount();
  same(w.resources().observersLive, 0);
  assert.doesNotThrow(() => unmount());
});

// ---------------------------------------------------------------- resetCategory (direct)

function resetParity(opts: CategoryOpts, before: Step[] = []) {
  let orig: OriginalCategory;
  return compareRuns({
    make: () => new CategoryScene(opts),
    original: (w) => {
      orig = w.runOriginal();
    },
    port: () => {},
    only: notIO,
    steps: [
      ...before,
      { op: "do", label: "resetCategory", original: (w) => orig.resetCategory(scene(w).cats[0].cover), ported: (w) => resetCategory(scene(w).parts(0)) },
    ],
  });
}

test("resetCategory: matches the original with everything present", () => {
  const r = resetParity({}, [done(0)]);
  assert.ok(r.ported.lines(/dataset\.done=/).length === 1, "done cleared");
  assert.ok(r.ported.lines(/style\.opacity=/).length === 2, "cta and bomb opacity cleared");
});
test("resetCategory: matches with each element missing", () => {
  for (const m of ["cta", "bomb", "countdown", "projects"] as const) resetParity({ missing: [m] }, [done(0)]);
});
// ---------------------------------------------------------------- revealProjects

function revealParity(opts: CategoryOpts, cat = 0) {
  const prefixes = [`projects[${cat}]`, `card[${cat}.`, `cover[${cat}].style.display`];
  return compareRuns({
    make: () => new CategoryScene(opts),
    original: (w) => {
      w.runOriginal();
    },
    port: () => {},
    only: touching(...prefixes),
    autoFrame: false,
    snapshots: false,
    steps: [
      { op: "do", label: "click (original) / nothing (port)", original: (w) => w.apply({ op: "click", cat }), ported: () => {} },
      {
        op: "do",
        label: "advance 4250 / reveal (port)",
        original: (w) => w.apply({ op: "advance", ms: 4250 }),
        ported: (w) => {
          w.apply({ op: "advance", ms: 4250 });
          revealProjects(scene(w).parts(cat));
        },
      },
    ],
  });
}

test("reveal: 3 cards, delays 0, 0.08, 0.16 and the fly-in replay order", () => {
  const r = revealParity({ cards: 3 });
  assert.ok(r.ported.lines(/animationDelay/).length === 3);
  assert.ok(r.ported.lines(/animationDelay=0\.16s/).length === 1);
});
test("reveal: 1 card and 0 cards", () => {
  revealParity({ cards: 1 });
  revealParity({ cards: 0 });
});
test("reveal: many cards keep the float formatting of i * 0.08", () => {
  const r = revealParity({ cards: 12 });
  assert.ok(r.ported.lines(/animationDelay=0\.24s/).length === 1);
  assert.ok(r.ported.lines(/animationDelay=0\.56s/).length === 1);
});
test("reveal: missing projects still hides the cover", () => {
  const r = revealParity({ missing: ["projects"] });
  assert.ok(r.ported.lines(/cover\[0\]\.style\.display=none/).length === 1);
});
test("reveal: second category", () => {
  revealParity({ cats: ["social", "ads"], cards: 2 }, 1);
});
test("reveal: calling it twice replays the animation again", () => {
  const w = new CategoryScene({ cards: 2 });
  revealProjects(w.parts(0));
  const first = w.log.length;
  revealProjects(w.parts(0));
  same(w.log.length, first * 2);
});

// ---------------------------------------------------------------- mutants

test("mutants: wrong top rule, missing done check and wrong delay factor are reported", () => {
  const bad = (m: { topRule?: boolean; checkDone?: boolean }) => () =>
    compareRuns({
      make: () => new CategoryScene({}),
      original: (w) => {
        w.runOriginal();
      },
      port: (w) => {
        const env = w.sectionResetEnv();
        env.createObserver(
          (entries) =>
            entries.forEach((e) => {
              const parts = env.sections[0].parts;
              if (!parts) return;
              if (m.checkDone !== false && !parts.cover.dataset.done) return;
              if (!e.isIntersecting && (m.topRule === false ? e.boundingClientRect.top >= 0 : e.boundingClientRect.top > 0)) resetCategory(parts);
            }),
          { threshold: 0 },
        ).observe(env.sections[0].target);
      },
      only: notIO,
      steps: [done(0), io(0, false, 0), io(0, false, 100)],
    });
  assert.doesNotThrow(bad({}), "sanity");
  assert.throws(bad({ topRule: false }), /log differs/);
  const notDone = () =>
    compareRuns({
      make: () => new CategoryScene({}),
      original: (w) => {
        w.runOriginal();
      },
      port: (w) => {
        const env = w.sectionResetEnv();
        env.createObserver((entries) => entries.forEach((e) => { if (!e.isIntersecting && e.boundingClientRect.top > 0 && env.sections[0].parts) resetCategory(env.sections[0].parts); }), { threshold: 0 }).observe(env.sections[0].target);
      },
      only: notIO,
      steps: [io(0, false, 100)],
    });
  assert.throws(notDone, /log differs/);
  const wrongDelay = () =>
    compareRuns({
      make: () => new CategoryScene({ cards: 3 }),
      original: (w) => {
        w.runOriginal();
      },
      port: () => {},
      only: touching("card[0."),
      autoFrame: false,
      snapshots: false,
      steps: [
        { op: "do", label: "click", original: (w) => w.apply({ op: "click" }), ported: () => {} },
        {
          op: "do",
          label: "advance / mutant reveal",
          original: (w) => w.apply({ op: "advance", ms: 4250 }),
          ported: (w) => {
            w.apply({ op: "advance", ms: 4250 });
            scene(w).parts(0).projects?.cards().forEach((c, i) => {
              c.classList.remove("fly-in");
              void c.offsetWidth;
              c.style.animationDelay = i * 0.1 + "s";
              c.classList.add("fly-in");
            });
          },
        },
      ],
    });
  assert.throws(wrongDelay, /log differs/);
});
