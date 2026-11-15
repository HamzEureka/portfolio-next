// STATUS: UNVERIFIED (Claude draft) — regression tests for the deliberate lifecycle deviations
import test from "node:test";
import assert from "node:assert/strict";
import { World, applyStep } from "./helpers/spotlight-harness";
import { mountSpotlight } from "../lib/spotlight-ui/index";

const mountOn = (w: World) => mountSpotlight(w.env());

test("unmount cancels a queued animation frame: nothing is written afterwards", () => {
  const w = new World({ n: 4 });
  const unmount = mountOn(w);
  applyStep(w, { op: "scroll", top: -1500 }); // queues a frame (not flushed)
  assert.equal(w.resources().raf, 1);
  unmount();
  assert.equal(w.resources().raf, 0, "frame cancelled");
  w.flushRaf();
  assert.deepEqual(w.cards.map((c) => c.style.transform), ["", "", "", ""], "no style written after unmount");
});

test("a mode switch still lets the queued frame run (original quirk kept)", () => {
  const w = new World({ n: 4 });
  mountOn(w);
  applyStep(w, { op: "scroll", top: -1500 });
  applyStep(w, { op: "mq", mobile: true });
  assert.equal(w.resources().raf, 1, "frame survives the switch");
});

test("unmount clears every pending dot-click resume timeout, listeners and dots", () => {
  const w = new World({ n: 4, mobile: true });
  const unmount = mountOn(w);
  applyStep(w, { op: "dot", i: 1 });
  applyStep(w, { op: "dot", i: 2 });
  assert.equal(w.resources().timeouts, 2);
  unmount();
  const r = w.resources();
  assert.equal(r.timeouts, 0);
  assert.equal(r.intervals, 0);
  assert.equal(r.touchstart + r.touchend + r.touchcancel, 0);
  assert.equal(r.mqChange, 0);
  assert.equal(r.scroll + r.resize, 0);
  assert.equal(r.dots, 0);
  unmount(); // safe to call twice
});

test("React Strict Mode: mount, unmount, mount again leaves exactly one live controller", () => {
  const w = new World({ n: 4 });
  mountOn(w)();
  mountOn(w);
  const r = w.resources();
  assert.equal(r.dots, 4);
  assert.equal(r.scroll, 1);
  assert.equal(r.resize, 1);
  assert.equal(r.mqChange, 1);
});

test("touch events with empty lists do not throw and never leave autoplay paused", () => {
  const w = new World({ n: 4, mobile: true });
  mountOn(w);
  const fire = (type: "touchstart" | "touchend") => {
    const e = { touches: [], changedTouches: [] };
    // reach the registered listeners through the harness' touch target
    (w as unknown as { touchL: Record<string, Set<(e: unknown) => void>> }).touchL[type].forEach((f) => f(e));
  };
  assert.doesNotThrow(() => { fire("touchstart"); fire("touchend"); });
  applyStep(w, { op: "tick" });
  assert.equal(w.dots[1].active, true, "autoplay advanced, so it is not stuck paused");
});
