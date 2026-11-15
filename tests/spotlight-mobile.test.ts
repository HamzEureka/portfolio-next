// STATUS: UNVERIFIED (DeepSeek draft)
import test from "node:test";
import assert from "node:assert/strict";
import { compareRuns, type Step, type World } from "./helpers/spotlight-harness";
import { createMobile } from "../lib/spotlight-ui/mobile";

const mount = (b: World) => {
  const m = createMobile(b.mobileCtx());
  b.dotClickOverride = (i) => m.goTo(i);
  m.start();
  return () => { m.stop(); m.dispose(); };
};

// a) 12 consecutive ticks (wrap-around for n in [2,3,4,6]).
for (const n of [2, 3, 4, 6]) {
  test(`a) 12 ticks n=${n}`, () => {
    const steps: Step[] = Array.from({ length: 12 }, () => ({ op: "tick" }) as Step);
    compareRuns({ opts: { n, mobile: true }, steps, mount });
  });
}

// b) touchstart pauses; ticks do not advance; touchend resumes.
for (const n of [2, 3, 4, 6]) {
  test(`b) touchstart / ticks / touchend n=${n}`, () => {
    const steps: Step[] = [
      { op: "touch", type: "touchstart", x: 100 },
      { op: "tick" },
      { op: "tick" },
      { op: "tick" },
      { op: "touch", type: "touchend", x: 100 },
      { op: "tick" },
      { op: "tick" },
    ];
    compareRuns({ opts: { n, mobile: true }, steps, mount });
  });
}

// c) swipes with various dx; |dx| <= 40 must not change the index but still unpauses.
for (const n of [2, 3, 4, 6]) {
  test(`c) swipes n=${n}`, () => {
    const dxs = [100, -100, 41, -41, 40, -40, 0];
    const steps: Step[] = [];
    for (const dx of dxs) {
      steps.push({ op: "touch", type: "touchstart", x: 100 });
      steps.push({ op: "touch", type: "touchend", x: 100 + dx });
    }
    compareRuns({ opts: { n, mobile: true }, steps, mount });
  });
}

// d) touchcancel after touchstart resumes autoplay.
for (const n of [2, 3, 4, 6]) {
  test(`d) touchcancel resumes n=${n}`, () => {
    const steps: Step[] = [
      { op: "touch", type: "touchstart", x: 100 },
      { op: "tick" },          // paused: no advance
      { op: "touch", type: "touchcancel" },
      { op: "tick" },          // resumed: advances
      { op: "tick" },
    ];
    compareRuns({ opts: { n, mobile: true }, steps, mount });
  });
}

// e) dot click for every i, then tick (paused), timeouts (resume), then tick (advances).
for (const n of [2, 3, 4, 6]) {
  test(`e) dot clicks + resume n=${n}`, () => {
    const steps: Step[] = [];
    for (let i = 0; i < n; i++) steps.push({ op: "dot", i });
    steps.push({ op: "tick" });     // paused: no advance
    steps.push({ op: "timeouts" }); // every resume timeout fires; paused=false
    steps.push({ op: "tick" });     // advances
    compareRuns({ opts: { n, mobile: true }, steps, mount });
  });
}

// f) a second dot click while the first resume is still pending, then timeouts.
for (const n of [2, 3, 4, 6]) {
  test(`f) two pending dot resumes n=${n}`, () => {
    const steps: Step[] = [
      { op: "dot", i: 0 },
      { op: "dot", i: 1 % n },
      { op: "timeouts" },
      { op: "tick" },
    ];
    compareRuns({ opts: { n, mobile: true }, steps, mount });
  });
}

// g) teardown resources (NOT a parity check).
test("g) teardown clears all resources", () => {
  const { ported, unmount } = compareRuns({
    opts: { n: 4, mobile: true },
    steps: [],
    mount,
  });
  assert.equal(typeof unmount, "function");
  // Before teardown: three touch listeners and one interval are live.
  assert.equal(ported.resources().touchstart, 1);
  assert.equal(ported.resources().touchend, 1);
  assert.equal(ported.resources().touchcancel, 1);
  assert.equal(ported.resources().intervals, 1);
  // Call teardown twice: the second call must not throw.
  (unmount as () => void)();
  (unmount as () => void)();
  const r = ported.resources();
  assert.equal(r.touchstart, 0);
  assert.equal(r.touchend, 0);
  assert.equal(r.touchcancel, 0);
  assert.equal(r.intervals, 0);
  assert.equal(r.timeouts, 0);
});
