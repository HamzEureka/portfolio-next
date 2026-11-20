// STATUS: UNVERIFIED (DeepSeek draft)
import test from "node:test";
import assert from "node:assert/strict";
import { World, compareRuns, type Step } from "./helpers/spotlight-harness";
import { createDesktop } from "../lib/spotlight-ui/desktop";

const mount = (b: World) => {
  const d = createDesktop(b.modeCtx());
  b.dotClickOverride = (i) => d.goTo(i);
  d.start();
  return () => d.stop();
};

const sweepSteps = (): Step[] => {
  const steps: Step[] = [];
  for (let top = 100; top >= -2700; top -= 150) steps.push({ op: "scroll", top });
  return steps;
};

// a) scroll sweep across the whole section for several n.
for (const n of [2, 4, 6]) {
  test(`a) scroll sweep n=${n}`, () => {
    compareRuns({ opts: { n, mobile: false }, steps: sweepSteps(), mount });
  });
}

// b) section not taller than the viewport: the original writes nothing.
for (const n of [2, 4, 6]) {
  test(`b) section not taller than viewport n=${n}`, () => {
    const steps: Step[] = [
      { op: "scroll", top: 100 },
      { op: "scroll", top: -200 },
      { op: "scroll", top: -600 },
      { op: "scroll", top: -1000 },
    ];
    compareRuns({ opts: { n, mobile: false, rect: { height: 700 } }, steps, mount });
  });
}

// c) resize across the 1000px threshold, from a mid-section scroll position.
for (const n of [2, 4, 6]) {
  test(`c) resize across 1000px n=${n}`, () => {
    const steps: Step[] = [
      { op: "scroll", top: -1100 },
      { op: "resize", width: 1000 },
      { op: "resize", width: 999 },
      { op: "resize", width: 1200 },
    ];
    compareRuns({ opts: { n, mobile: false }, steps, mount });
  });
}

// d) dot clicks for every i after preparing scrollY and rect.top silently.
for (const n of [2, 4, 6]) {
  test(`d) dot clicks n=${n}`, () => {
    const steps: Step[] = [
      { op: "scrollY", y: 1234 },
      { op: "rect", top: -300 },
    ];
    for (let i = 0; i < n; i++) steps.push({ op: "dot", i });
    compareRuns({ opts: { n, mobile: false }, steps, mount });
  });
}

// e) rAF throttling: no intermediate flush, then a single "raf" step flushes once.
test("e) rAF throttling with flush:false", () => {
  const steps: Step[] = [
    { op: "scroll", top: 0 },
    { op: "scroll", top: -300 },
    { op: "scroll", top: -600 },
    { op: "scroll", top: -900 },
    { op: "scroll", top: -1200 },
    { op: "raf" },
  ];
  compareRuns({ opts: { n: 4, mobile: false }, steps, mount, flush: false });
});

// f) n=1: v4 produced NaN in goTo (0/0). DELIBERATE DEVIATION (v11 spotlight-n1.patch): finite target; see tests/v11-spotlight-n1.test.ts.

// g) teardown (NOT a parity check): after stop(), cards are cleared and listeners removed.
test("g) teardown resets card styles and removes listeners", () => {
  const { ported, unmount } = compareRuns({
    opts: { n: 4, mobile: false },
    steps: [],
    mount,
  });
  assert.equal(typeof unmount, "function");
  // Styles were set at mount (render runs synchronously from start()).
  assert.notEqual(String(ported.cards[0].style.transform), "");
  assert.equal(ported.resources().scroll, 1);
  assert.equal(ported.resources().resize, 1);
  (unmount as () => void)();
  for (const c of ported.cards) {
    assert.equal(String(c.style.transform), "");
    assert.equal(String(c.style.opacity), "");
    assert.equal(String(c.style.filter), "");
    assert.equal(String(c.style.zIndex), "");
  }
  assert.equal(ported.resources().scroll, 0);
  assert.equal(ported.resources().resize, 0);
});
