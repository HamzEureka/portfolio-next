import test from "node:test";
import assert from "node:assert/strict";
import { World, applyStep, compareRuns, type Step } from "./helpers/spotlight-harness";

/* Sanity checks of the shared harness itself (see tests/helpers/spotlight-harness.ts). */

const DESKTOP_STEPS: Step[] = [
  { op: "scroll", top: -200 }, { op: "scroll", top: -900 }, { op: "scroll", top: -2200 }, { op: "scroll", top: -3000 },
  { op: "resize", width: 900 }, { op: "scrollY", y: 5000 }, { op: "dot", i: 2 }, { op: "dot", i: 0 },
];
const MOBILE_STEPS: Step[] = [
  { op: "tick" }, { op: "tick" }, { op: "touch", type: "touchstart", x: 100 }, { op: "tick" },
  { op: "touch", type: "touchend", x: 200 }, { op: "dot", i: 3 }, { op: "tick" }, { op: "timeouts" }, { op: "tick" },
];

test("harness: the original code behaves deterministically in two identical worlds (desktop)", () => {
  compareRuns({ opts: { n: 4 }, steps: DESKTOP_STEPS, mount: (b) => b.runOriginal() });
});

test("harness: the original code behaves deterministically in two identical worlds (mobile)", () => {
  compareRuns({ opts: { n: 4, mobile: true }, steps: MOBILE_STEPS, mount: (b) => b.runOriginal() });
});

test("harness: desktop original writes card styles, activates dots and scrolls on dot click", () => {
  const w = new World({ n: 4 });
  w.runOriginal();
  assert.equal(w.dots.length, 4);
  assert.match(String(w.cards[0].style.transform), /^translate\(-50%, -50%\) translateX\(/);
  applyStep(w, { op: "scroll", top: -1100 });
  w.flushRaf();
  assert.ok(w.dots.some((d) => d.active), "one dot is active after scrolling");
  applyStep(w, { op: "dot", i: 1 });
  assert.equal(w.scrolls.length, 1);
  assert.equal(w.scrolls[0].behavior, "smooth");
});

test("harness: mobile original autoplays, swipes and pauses on dot click", () => {
  const w = new World({ n: 4, mobile: true });
  w.runOriginal();
  assert.equal(w.resources().intervals, 1);
  assert.equal(w.dots[0].active, true);
  applyStep(w, { op: "tick" });
  assert.equal(w.dots[1].active, true);
  applyStep(w, { op: "touch", type: "touchstart", x: 100 });
  applyStep(w, { op: "touch", type: "touchend", x: 200 }); // dx = +100 -> next
  assert.equal(w.dots[2].active, true);
  applyStep(w, { op: "dot", i: 0 });
  assert.equal(w.dots[0].active, true);
  assert.equal(w.resources().timeouts, 1, "dot click schedules the 3000 ms resume");
});

test("harness: reduced motion makes the original do nothing", () => {
  const w = new World({ n: 4, reducedMotion: true });
  w.runOriginal();
  assert.equal(w.dots.length, 0);
  assert.equal(w.cards[0].style.transform, "");
});

test("harness: a port that does nothing is reported as different", () => {
  assert.throws(() => compareRuns({ opts: { n: 4 }, steps: DESKTOP_STEPS, mount: () => {} }), /after mount/);
});
