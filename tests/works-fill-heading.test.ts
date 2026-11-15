// STATUS: UNVERIFIED (Claude draft; run in the cloud sandbox only, not yet on the owner's machine)
/**
 * W5 parity: lib/works/fill-heading.ts against the verbatim v4 block (tests/fixtures/works-original-fill-heading.js,
 * site/index.html:2631-2659), step by step, in the fake world of tests/helpers/works-harness.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { FillScene, compareRuns, same, type FillOpts, type Step } from "./helpers/works-harness";
import { FILL_END, FILL_START, fillClipPath, fillProgress, mountFillHeading } from "../lib/works/fill-heading";

const mount = (w: FillScene) => mountFillHeading(w.env());

/** Runs the original in world A and the port in world B, asserts identical behaviour and identical listener setup. */
function parity(opts: FillOpts, steps: Step[] = [], autoFrame = true) {
  const r = compareRuns({
    make: () => new FillScene(opts),
    original: (w) => w.runOriginal(),
    port: mount,
    steps,
    autoFrame,
  });
  same(r.ported.listenerRegistrations, r.original.listenerRegistrations, "same listeners, same options");
  same(r.ported.resources(), r.original.resources(), "same live resources");
  return r;
}

// ---------------------------------------------------------------- pure functions

test("constants keep their v4 values (index.html:2640-2641)", () => {
  assert.equal(FILL_START, 0.9);
  assert.equal(FILL_END, 0.25);
});

test("fillProgress: 0 at 0.9vh, 1 at 0.25vh, linear in between, clamped outside", () => {
  assert.equal(fillProgress(720, 800), 0);
  assert.equal(fillProgress(200, 800), 1);
  assert.equal(fillProgress(460, 800), 0.5);
  assert.equal(fillProgress(5000, 800), 0);
  assert.equal(fillProgress(-5000, 800), 1);
});

test("fillClipPath: inset(0 <100 - progress*100>% 0 0) with default number formatting", () => {
  assert.equal(fillClipPath(0), "inset(0 100% 0 0)");
  assert.equal(fillClipPath(1), "inset(0 0% 0 0)");
  assert.equal(fillClipPath(0.5), "inset(0 50% 0 0)");
  assert.equal(fillClipPath(0.25), "inset(0 75% 0 0)");
  assert.equal(fillClipPath(NaN), "inset(0 NaN% 0 0)");
});

// ---------------------------------------------------------------- mount (the first write)

test("mount: the clip-path is written synchronously, exactly like the original, over a grid of viewports and positions", () => {
  let cases = 0;
  for (const vh of [0, 1, 320, 600, 800, 1080, 1440, 2160.5]) {
    const start = vh * 0.9;
    const end = vh * 0.25;
    const tops = [start, start + 1, start - 1, end, end - 1, end + 1, (start + end) / 2, start - (start - end) / 3, 0, -1, 1, 1e6, -1e6, 333.3333];
    for (const top of tops) {
      parity({ vh, top });
      cases++;
    }
  }
  assert.equal(cases, 8 * 14);
});

test("mount quirk: innerHeight 0 writes NaN for top 0 and a clamped value for any other top (as the original does)", () => {
  const nan = parity({ vh: 0, top: 0 });
  same(nan.ported.log, ["@0 fill.style.clipPath=inset(0 NaN% 0 0)"]);
  same(parity({ vh: 0, top: 5 }).ported.log, ["@0 fill.style.clipPath=inset(0 100% 0 0)"]);
  same(parity({ vh: 0, top: -5 }).ported.log, ["@0 fill.style.clipPath=inset(0 0% 0 0)"]);
});

test("mount: reduced motion registers nothing and writes nothing, and scroll/resize stay inert", () => {
  const r = parity({ reduceMotion: true }, [{ op: "top", v: 100 }, { op: "scroll" }, { op: "resize", height: 400 }]);
  same(r.ported.log, []);
  same(r.ported.listenerRegistrations, []);
});

test("mount: scroll listener is passive, resize listener has no options, registered in that order", () => {
  const r = parity({});
  same(r.ported.listenerRegistrations, ['scroll:{"passive":true}', "resize:none"]);
});

// ---------------------------------------------------------------- scrolling and resizing

test("scrolling top-to-bottom and back: every step writes what the original writes", () => {
  const steps: Step[] = [];
  for (let top = 1000; top >= -200; top -= 37) steps.push({ op: "top", v: top }, { op: "scroll" });
  for (let top = -200; top <= 1000; top += 53) steps.push({ op: "top", v: top }, { op: "scroll" });
  const r = parity({ top: 1000 }, steps);
  assert.ok(r.ported.lines(/clipPath/).length > 40, "many writes were compared");
});

test("resize: the same update runs, with the new innerHeight (also to 0)", () => {
  parity({ top: 500 }, [
    { op: "resize", height: 400 },
    { op: "resize", height: 1200 },
    { op: "top", v: 0 },
    { op: "resize", height: 0 },
    { op: "resize", height: 800 },
  ]);
});

test("throttling: several events before a frame cause ONE write; the next event after the frame writes again", () => {
  const r = parity(
    { top: 900 },
    [
      { op: "top", v: 460 },
      { op: "scroll" },
      { op: "scroll" },
      { op: "resize", height: 800 },
      { op: "frame" },
      { op: "top", v: 300 },
      { op: "scroll" },
      { op: "scroll" },
      { op: "frame" },
      { op: "frame" },
    ],
    false,
  );
  same(r.ported.lines(/clipPath/).length, 3, "mount write + one per frame, not one per event");
  same(r.ported.log, r.original.log);
});

test("the frame reads the rect at frame time, not at event time", () => {
  parity({ top: 900 }, [{ op: "top", v: 700 }, { op: "scroll" }, { op: "top", v: 250 }, { op: "frame" }], false);
});

// ---------------------------------------------------------------- dispose (DEVIATION: the original never cleans up)

test("unmount removes both listeners; later scroll/resize events write nothing", () => {
  const w = new FillScene({ top: 900 });
  const unmount = mount(w);
  same(w.resources().scroll, 1);
  same(w.resources().resize, 1);
  unmount();
  same(w.resources().scroll, 0);
  same(w.resources().resize, 0);
  w.log.length = 0;
  w.apply({ op: "top", v: 100 });
  w.apply({ op: "scroll" });
  w.apply({ op: "resize", height: 500 });
  w.apply({ op: "frame" });
  same(w.log, []);
});

test("unmount cancels a queued frame, and calling it twice is harmless", () => {
  const w = new FillScene({ top: 900 });
  const unmount = mount(w);
  w.apply({ op: "top", v: 300 });
  w.apply({ op: "scroll" });
  same(w.resources().frames, 1);
  unmount();
  same(w.resources().frames, 0);
  w.log.length = 0;
  w.apply({ op: "frame" });
  same(w.log, []);
  assert.doesNotThrow(() => unmount());
});

test("unmount of a reduced-motion mount is a harmless no-op", () => {
  const w = new FillScene({ reduceMotion: true });
  const unmount = mount(w);
  assert.doesNotThrow(() => {
    unmount();
    unmount();
  });
});

// ---------------------------------------------------------------- the comparison has teeth (mutants must be caught)

/** A deliberately wrong port; each knob breaks one thing the real port must keep. */
function mutant(w: FillScene, m: { end?: number; clamp?: boolean; sync?: boolean }): () => void {
  const { win, heading, fill } = w.env();
  const update = (): void => {
    const vh = win.innerHeight;
    const start = vh * 0.9;
    const end = vh * (m.end ?? 0.25);
    let p = (start - heading.getBoundingClientRect().top) / (start - end);
    if (m.clamp !== false) p = Math.max(0, Math.min(1, p));
    fill.style.clipPath = fillClipPath(p);
  };
  win.addEventListener("scroll", () => win.requestAnimationFrame(update), { passive: true });
  win.addEventListener("resize", () => win.requestAnimationFrame(update));
  if (m.sync !== false) update();
  return () => {};
}
const run = (m: Parameters<typeof mutant>[1], steps: Step[]) => () =>
  compareRuns({ make: () => new FillScene({ top: 900 }), original: (w) => w.runOriginal(), port: (w) => mutant(w, m), steps });

test("mutants: a wrong constant, a missing clamp and a missing synchronous first update are all reported", () => {
  const steps: Step[] = [{ op: "top", v: 300 }, { op: "scroll" }, { op: "top", v: 50 }, { op: "scroll" }];
  assert.doesNotThrow(run({}, steps), "the mutant with no defect behaves like the original (sanity)");
  assert.throws(run({ end: 0.3 }, steps), /log differs/);
  assert.throws(run({ clamp: false }, steps), /log differs/);
  assert.throws(run({ sync: false }, steps), /log differs after mount/);
});
