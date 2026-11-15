// STATUS: UNVERIFIED (DeepSeek draft)
import test from "node:test";
import assert from "node:assert/strict";
import {
  World, applyStep, compareRuns, DOT_LABEL, type Step,
} from "./helpers/spotlight-harness";
import { mountSpotlight } from "../lib/spotlight-ui/index";

const mount = (b: World) => mountSpotlight(b.env());

// a) Replay standard scenarios in both initial modes, several n.
for (const n of [2, 4, 6]) {
  test(`a) initial desktop n=${n}`, () => {
    const steps: Step[] = [
      { op: "scroll", top: -500 },
      { op: "scroll", top: -1500 },
      { op: "dot", i: 2 % n },
      { op: "scroll", top: -2500 },
      { op: "resize", width: 900 },
      { op: "dot", i: 0 },
    ];
    compareRuns({ opts: { n, mobile: false }, steps, mount });
  });

  test(`a) initial mobile n=${n}`, () => {
    const steps: Step[] = [
      { op: "tick" },
      { op: "touch", type: "touchstart", x: 100 },
      { op: "touch", type: "touchend", x: 200 },
      { op: "dot", i: 1 % n },
      { op: "tick" },
      { op: "timeouts" },
      { op: "tick" },
    ];
    compareRuns({ opts: { n, mobile: true }, steps, mount });
  });
}

// b) Mode switching via the "mq" step.
for (const n of [2, 4, 6]) {
  test(`b1) desktop -> mobile -> desktop n=${n}`, () => {
    const steps: Step[] = [
      { op: "scroll", top: -1000 },
      { op: "mq", mobile: true },
      { op: "tick" },
      { op: "mq", mobile: false },
      { op: "scroll", top: -2000 },
      { op: "dot", i: 1 % n },
    ];
    compareRuns({ opts: { n, mobile: false }, steps, mount });
  });

  test(`b2) mobile -> desktop -> mobile n=${n}`, () => {
    const steps: Step[] = [
      { op: "tick" },
      { op: "mq", mobile: false },
      { op: "scroll", top: -800 },
      { op: "mq", mobile: true },
      { op: "tick" },
    ];
    compareRuns({ opts: { n, mobile: true }, steps, mount });
  });

  test(`b3) four repeated flips n=${n}`, () => {
    const steps: Step[] = [
      { op: "mq", mobile: true },
      { op: "mq", mobile: false },
      { op: "mq", mobile: true },
      { op: "mq", mobile: false },
    ];
    compareRuns({ opts: { n, mobile: false }, steps, mount });
  });
}

// b4) Pending-rAF quirk: a scheduled frame survives a mode switch and OVERWRITES mobile styles.
test("b4) pending rAF survives an mq switch (flush:false)", () => {
  const steps: Step[] = [
    { op: "scroll", top: -1000 }, // schedules rAF, ticking = true
    { op: "mq", mobile: true },    // cleanupDesktop, mobile.start(); rAF still queued
    { op: "raf" },                 // pending renderDesktop fires -> desktop styles win
    { op: "tick" },                // mobile interval writes mobile styles back
  ];
  compareRuns({ opts: { n: 4, mobile: false }, steps, mount, flush: false });
});

// c) Reduced motion and n = 0: no dots, no card writes, all resources zero.
test("c) reduced motion is a no-op", () => {
  const a = new World({ n: 4, reducedMotion: true });
  const b = new World({ n: 4, reducedMotion: true });
  a.runOriginal();
  const unmount = mount(b);
  assert.deepStrictEqual(b.snapshot(), a.snapshot());
  for (const w of [a, b]) {
    const r = w.resources();
    assert.equal(r.scroll, 0);
    assert.equal(r.resize, 0);
    assert.equal(r.touchstart, 0);
    assert.equal(r.touchend, 0);
    assert.equal(r.touchcancel, 0);
    assert.equal(r.mqChange, 0);
    assert.equal(r.intervals, 0);
    assert.equal(r.timeouts, 0);
    assert.equal(r.dots, 0);
    for (const c of w.cards) {
      assert.equal(String(c.style.transform), "");
      assert.equal(String(c.style.opacity), "");
      assert.equal(String(c.style.filter), "");
      assert.equal(String(c.style.zIndex), "");
    }
  }
  unmount();
});

test("c) n = 0 is a no-op", () => {
  const a = new World({ n: 0 });
  const b = new World({ n: 0 });
  a.runOriginal();
  const unmount = mount(b);
  assert.deepStrictEqual(b.snapshot(), a.snapshot());
  for (const w of [a, b]) {
    const r = w.resources();
    assert.equal(r.scroll, 0);
    assert.equal(r.resize, 0);
    assert.equal(r.touchstart, 0);
    assert.equal(r.mqChange, 0);
    assert.equal(r.dots, 0);
  }
  unmount();
});

// d) Explicit dot shape assertion for n = 4.
test("d) dots have the expected shape (n=4)", () => {
  const b = new World({ n: 4 });
  const unmount = mount(b);
  assert.equal(b.dots.length, 4);
  for (let i = 0; i < 4; i++) {
    assert.equal(b.dots[i].type, "button");
    assert.equal(b.dots[i].className, "spotlight-dot");
    assert.equal(b.dots[i].attrs["aria-label"], DOT_LABEL(i));
  }
  unmount();
});

// e) Unmount clears every resource; a second call must not throw.
for (const mobile of [false, true]) {
  for (const n of [2, 4, 6]) {
    test(`e) unmount clears resources mobile=${mobile} n=${n}`, () => {
      const b = new World({ n, mobile });
      const unmount = mount(b);
      unmount();
      unmount(); // must not throw
      const r = b.resources();
      assert.equal(r.scroll, 0);
      assert.equal(r.resize, 0);
      assert.equal(r.touchstart, 0);
      assert.equal(r.touchend, 0);
      assert.equal(r.touchcancel, 0);
      assert.equal(r.mqChange, 0);
      assert.equal(r.intervals, 0);
      assert.equal(r.timeouts, 0);
      assert.equal(r.dots, 0);
    });
  }
}

// f) StrictMode-like: mount -> unmount -> mount again. No doubled listeners, controller still works.
for (const mobile of [false, true]) {
  for (const n of [2, 4]) {
    test(`f) remount mobile=${mobile} n=${n}`, () => {
      const b = new World({ n, mobile });
      const u1 = mount(b);
      u1();
      const u2 = mount(b);
      const r = b.resources();
      assert.equal(r.scroll, mobile ? 0 : 1);
      assert.equal(r.resize, mobile ? 0 : 1);
      assert.equal(r.touchstart, 1);
      assert.equal(r.mqChange, 1);
      assert.equal(r.dots, n);
      assert.equal(r.intervals, mobile ? 1 : 0);

      if (mobile) {
        assert.equal(b.dots[0].active, true);
        applyStep(b, { op: "tick" });
        assert.equal(b.dots[1].active, true);
        assert.equal(b.dots[0].active, false);
      } else {
        // Fresh desktop controller: render() set lastNearest = 0 at start.
        assert.equal(b.dots[0].active, true);
        applyStep(b, { op: "scroll", top: -2000 });
        b.flushRaf();
        const expected = Math.round(((( -(-2000) / 2200) - 0.08) / 0.84) * (n - 1));
        assert.equal(b.dots[expected].active, true);
      }
      u2();
    });
  }
}
