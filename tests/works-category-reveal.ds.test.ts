// STATUS: UNVERIFIED (DeepSeek draft, reviewed by Claude; independent second suite, run in the cloud sandbox only)
/**
 * W7 parity: lib/works/category-reveal.ts against the verbatim v4 category block
 * (tests/fixtures/works-original-category.js, site/index.html:2579-2592, 2604-2614, 2620-2629).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CategoryScene,
  compareRuns,
  notIO,
  same,
  touching,
  type OriginalCategory,
  type Step,
} from "./helpers/works-harness";
import { mountSectionReset, resetCategory, revealProjects } from "../lib/works/category-reveal";

type Missing = "cta" | "bomb" | "countdown" | "flash" | "projects";

const markDoneStep = (i: number): Step => ({
  op: "do",
  label: `mark category ${i} done`,
  original: (w) => (w as CategoryScene).markDone(i),
  ported: (w) => (w as CategoryScene).markDone(i),
});

const ioStep = (cat: number, isIntersecting: boolean, top: number): Step => ({
  op: "io",
  cat,
  isIntersecting,
  top,
});

function observerParity(cats: string[], steps: Step[]) {
  return compareRuns({
    make: () => new CategoryScene({ cats }),
    original: (w) => w.runOriginal(),
    port: (w) => mountSectionReset(w.sectionResetEnv()),
    steps,
  });
}

function prepareReset(w: CategoryScene): void {
  const cat = w.cats[0];
  cat.countdown?.classList.init("show", "pulse");
  if (cat.projects) cat.projects.style.display = "grid";
}

function resetParity(missing: Missing[] = [], before: (w: CategoryScene) => void = () => {}): ReturnType<typeof compareRuns<CategoryScene>> {
  let orig: OriginalCategory | undefined;

  return compareRuns({
    make: () => new CategoryScene({ cats: ["social"], missing }),
    original: (w) => {
      orig = w.runOriginal();
    },
    port: () => {},
    only: notIO,
    steps: [
      {
        op: "do",
        label: "prepare reset state",
        original: (w) => before(w as CategoryScene),
        ported: (w) => before(w as CategoryScene),
      },
      {
        op: "do",
        label: "resetCategory",
        original: (w) => {
          if (!orig) throw new Error("original category functions were not initialised");
          orig.resetCategory((w as CategoryScene).cats[0].cover);
        },
        ported: (w) => resetCategory((w as CategoryScene).parts(0)),
      },
    ],
  });
}

function revealParity(opts: { cards?: number; missing?: Missing[] } = {}) {
  return compareRuns({
    make: () => new CategoryScene({ cats: ["social"], cards: opts.cards, missing: opts.missing }),
    original: (w) => {
      w.runOriginal();
    },
    port: () => {},
    only: touching("projects[", "card[", "cover[0].style.display"),
    autoFrame: false,
    snapshots: false,
    steps: [
      {
        op: "do",
        label: "click (original) / nothing (port)",
        original: (w) => w.apply({ op: "click" }),
        ported: () => {},
      },
      {
        op: "do",
        label: "advance 4250 / reveal (port)",
        original: (w) => w.apply({ op: "advance", ms: 4250 }),
        ported: (w) => {
          w.apply({ op: "advance", ms: 4250 });
          revealProjects((w as CategoryScene).parts(0));
        },
      },
    ],
  });
}

function mutantObserver(w: CategoryScene, opts: { ge?: boolean; ignoreDone?: boolean }): () => void {
  const env = w.sectionResetEnv();
  const observer = env.createObserver((entries) => {
    entries.forEach((entry) => {
      const section = env.sections.find((candidate) => candidate.target === entry.target);
      if (!section) return;
      const parts = section.parts;
      if (!parts) return;
      if (!opts.ignoreDone && !parts.cover.dataset.done) return;

      const topOk = opts.ge ? entry.boundingClientRect.top >= 0 : entry.boundingClientRect.top > 0;
      if (!entry.isIntersecting && topOk) resetCategory(parts);
    });
  }, { threshold: 0 });

  env.sections.forEach((section) => observer.observe(section.target));
  return () => observer.disconnect();
}

function mutantReveal(w: CategoryScene, factor: number): void {
  const parts = w.parts(0);
  parts.cover.style.display = "none";
  if (!parts.projects) return;

  parts.projects.style.display = "";
  parts.projects.cards().forEach((card, i) => {
    card.classList.remove("fly-in");
    void card.offsetWidth;
    card.style.animationDelay = (i * factor) + "s";
    card.classList.add("fly-in");
  });
}

// ---------------------------------------------------------------- observer

test("observer: ignores not done, intersecting, and top<=0; resets only done leaving through the bottom", () => {
  const r = observerParity(["social", "ads"], [
    ioStep(0, false, 100),
    markDoneStep(0),
    ioStep(0, true, 100),
    ioStep(0, false, 0),
    ioStep(0, false, -1),
    ioStep(1, false, 100),
    markDoneStep(1),
    ioStep(1, false, 100),
    ioStep(0, false, 100),
  ]);

  same(r.ported.lines(/projects\[0\]\.style\.display=none/).length, 1);
  same(r.ported.lines(/projects\[1\]\.style\.display=none/).length, 1);
});

test("observer: a not-done category is never reset", () => {
  const r = observerParity(["social"], [ioStep(0, false, 100)]);
  same(r.ported.lines(/projects\[0\]\.style\.display=none/), []);
  same(r.ported.lines(/cover\[0\]\.dataset\.done=/), []);
});

test("observer: done but still visible is not reset", () => {
  const r = observerParity(["social"], [markDoneStep(0), ioStep(0, true, 100)]);
  same(r.ported.lines(/projects\[0\]\.style\.display=none/), []);
});

test("observer: done and leaving through the top (top 0 or negative) is not reset", () => {
  const r = observerParity(["social"], [
    markDoneStep(0),
    ioStep(0, false, 0),
    ioStep(0, false, -1),
  ]);
  same(r.ported.lines(/projects\[0\]\.style\.display=none/), []);
});

test("observer: repeated events after a reset do nothing more", () => {
  const r = observerParity(["social"], [
    markDoneStep(0),
    ioStep(0, false, 100),
    ioStep(0, false, 100),
  ]);
  same(r.ported.lines(/projects\[0\]\.style\.display=none/).length, 1);
});

test("observer: unmount disconnects, and repeated unmount is harmless", () => {
  const r = observerParity(["social"], []);
  same(r.ported.resources().observersLive, 1);
  r.unmount?.();
  same(r.ported.resources().observersLive, 0);
  r.unmount?.();
});

test("observer: a section whose parts are null is ignored", () => {
  const w = new CategoryScene({ cats: ["social"] });
  const env = w.sectionResetEnv();
  const target = w.cats[0].section;
  const unmount = mountSectionReset({
    sections: [{ target, parts: null }],
    createObserver: env.createObserver,
  });

  w.log.length = 0;
  const observer = w.observers[0];
  assert.ok(observer);
  observer.callback([{ target, isIntersecting: false, boundingClientRect: { top: 100 } }]);
  same(w.log, []);
  unmount();
});

test("observer: an unknown entry target is ignored", () => {
  const w = new CategoryScene({ cats: ["social"] });
  const unmount = mountSectionReset(w.sectionResetEnv());
  const other = w.el("other");

  w.log.length = 0;
  const observer = w.observers[0];
  assert.ok(observer);
  observer.callback([{ target: other, isIntersecting: false, boundingClientRect: { top: 100 } }]);
  same(w.log, []);
  unmount();
});

test("observer: zero sections still creates exactly one observer", () => {
  const w = new CategoryScene({ cats: ["social"] });
  const env = w.sectionResetEnv();
  const unmount = mountSectionReset({ sections: [], createObserver: env.createObserver });

  same(w.resources().observersLive, 1);
  const observer = w.observers[0];
  assert.ok(observer);
  same(observer.targets.length, 0);

  unmount();
  unmount();
  same(w.resources().observersLive, 0);
});

// ---------------------------------------------------------------- resetCategory

test("resetCategory: all elements present; countdown classes are removed", () => {
  const r = resetParity([], prepareReset);
  const cat = r.ported.cats[0];

  same(cat.projects?.style.display, "none");
  same(cat.cover.style.display, "");
  same(cat.cover.dataset.done, "");
  same(cat.cta?.style.opacity, "");
  same(cat.bomb?.style.opacity, "");
  assert.equal(cat.countdown?.classList.contains("show"), false);
  assert.equal(cat.countdown?.classList.contains("pulse"), false);
});

test("resetCategory: each optional element may be missing without changing behaviour", () => {
  for (const missing of ["cta", "bomb", "countdown", "flash", "projects"] as const) {
    resetParity([missing], prepareReset);
  }
});

test("resetCategory: projects absent still resets the cover", () => {
  const r = resetParity(["projects"], prepareReset);
  const cat = r.ported.cats[0];

  same(cat.projects, null);
  same(cat.cover.style.display, "");
  same(cat.cover.dataset.done, "");
});

// ---------------------------------------------------------------- revealProjects

test("revealProjects: cover hidden and project cards replay fly-in for 0, 1 and 3 cards", () => {
  for (const cards of [0, 1, 3]) {
    const r = revealParity({ cards });
    if (cards === 0) {
      same(r.ported.lines(/card\[/), []);
    } else {
      assert.ok(r.ported.lines(/card\[/).length > 0);
    }
  }
});

test("revealProjects: delays keep the exact (i * 0.08) + 's' formatting", () => {
  const r = revealParity({ cards: 3 });
  same(
    r.ported.cats[0].cards.map((card) => card.style.animationDelay),
    ["0s", "0.08s", "0.16s"],
  );
});

test("revealProjects: projects absent still hides the cover and writes nothing else", () => {
  const r = revealParity({ cards: 3, missing: ["projects"] });
  same(r.ported.lines(/projects\[/), []);
  same(r.ported.lines(/card\[/), []);
  same(r.ported.cats[0].cover.style.display, "none");
});

test("revealProjects: calling it twice replays fly-in with the same delays", () => {
  const w = new CategoryScene({ cats: ["social"], cards: 3 });
  w.log.length = 0;
  revealProjects(w.parts(0));
  revealProjects(w.parts(0));

  same(w.cats[0].cards.map((card) => card.style.animationDelay), ["0s", "0.08s", "0.16s"]);
  for (const card of w.cats[0].cards) assert.ok(card.classList.contains("fly-in"));
  same(w.lines(/card\[0\.0\].*remove/).length, 2);
  same(w.cats[0].cover.style.display, "none");
  same(w.cats[0].projects?.style.display, "");
});

// ---------------------------------------------------------------- mutants

test("mutants: wrong top boundary, missing done guard, and wrong delay factor are rejected", () => {
  assert.throws(
    () =>
      compareRuns({
        make: () => new CategoryScene({ cats: ["social"] }),
        original: (w) => w.runOriginal(),
        port: (w) => mutantObserver(w as CategoryScene, { ge: true }),
        steps: [markDoneStep(0), ioStep(0, false, 0)],
      }),
    /log differs/,
  );

  assert.throws(
    () =>
      compareRuns({
        make: () => new CategoryScene({ cats: ["social"] }),
        original: (w) => w.runOriginal(),
        port: (w) => mutantObserver(w as CategoryScene, { ignoreDone: true }),
        steps: [ioStep(0, false, 100)],
      }),
    /log differs/,
  );

  assert.throws(
    () =>
      compareRuns({
        make: () => new CategoryScene({ cats: ["social"], cards: 3 }),
        original: (w) => {
          w.runOriginal();
        },
        port: () => {},
        only: touching("projects[", "card[", "cover[0].style.display"),
        autoFrame: false,
        snapshots: false,
        steps: [
          {
            op: "do",
            label: "click (original) / nothing (port)",
            original: (w) => w.apply({ op: "click" }),
            ported: () => {},
          },
          {
            op: "do",
            label: "advance 4250 / reveal mutant",
            original: (w) => w.apply({ op: "advance", ms: 4250 }),
            ported: (w) => {
              w.apply({ op: "advance", ms: 4250 });
              mutantReveal(w as CategoryScene, 0.1);
            },
          },
        ],
      }),
    /log differs/,
  );
});
