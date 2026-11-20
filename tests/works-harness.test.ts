// STATUS: UNVERIFIED (Claude draft; run in the cloud sandbox only, not yet on the owner's machine)
/**
 * Sanity checks of the shared harness (tests/helpers/works-harness.ts) AGAINST THE VERBATIM v4 ORIGINALS.
 * They also document, as executable facts, what the original code does; ports are compared against the same
 * behaviour by their own tests. Every expected value below was derived from reading v4 (line numbers in the
 * test names), then confirmed by running the original in the fake world.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CategoryScene, Clock, FillScene, FRAME_MS, PlaybackScene, compareRuns, same, type Step,
} from "./helpers/works-harness";

// ---------------------------------------------------------------- clock

test("clock: timers fire in due order, ties by creation order, nested timers at the same instant run too", () => {
  const c = new Clock();
  const seen: string[] = [];
  c.setTimeout(() => seen.push("b@700"), 700);
  c.setTimeout(() => {
    seen.push("a@300");
    c.setTimeout(() => seen.push("nested@300"), 0);
    c.setTimeout(() => seen.push("nested@400"), 100);
  }, 300);
  c.setTimeout(() => seen.push("c@700"), 700);
  c.advance(699);
  same(seen, ["a@300", "nested@300", "nested@400"]);
  assert.equal(c.now, 699);
  c.advance(1);
  same(seen, ["a@300", "nested@300", "nested@400", "b@700", "c@700"]);
});

test("clock: animation frames run on 16 ms boundaries with the boundary time, after timers of the same instant", () => {
  const c = new Clock();
  const seen: string[] = [];
  c.setTimeout(() => seen.push("timer@32"), 32);
  c.requestAnimationFrame((t) => seen.push(`frame@${t}`));
  c.advance(10);
  same(seen, [], "no boundary reached yet");
  c.advance(6); // now = 16
  same(seen, ["frame@16"]);
  c.requestAnimationFrame((t) => seen.push(`frame2@${t}`)); // requested exactly on a boundary -> next boundary
  c.advance(16); // now = 32: timer first, then the frame
  same(seen, ["frame@16", "timer@32", "frame2@32"]);
  assert.equal(FRAME_MS, 16);
});

test("clock: cancelAnimationFrame / clearTimeout remove pending work; flushFrames runs frames without moving time", () => {
  const c = new Clock();
  const seen: string[] = [];
  const t = c.setTimeout(() => seen.push("timer"), 5);
  const f = c.requestAnimationFrame(() => seen.push("cancelled-frame"));
  c.requestAnimationFrame((now) => seen.push(`flushed@${now}`));
  c.clearTimeout(t);
  c.cancelAnimationFrame(f);
  c.flushFrames();
  same(seen, ["flushed@0"]);
  c.advance(100);
  same(seen, ["flushed@0"]);
  same(c.pending(), { timers: 0, frames: 0 });
});

// ---------------------------------------------------------------- W5 original (index.html:2631-2659)

test("W5 original: writes the clip-path at mount from rect.top and window.innerHeight (start 0.9vh, end 0.25vh)", () => {
  const cases: Array<[number, string]> = [
    [1000, "inset(0 100% 0 0)"], // progress < 0 clamps to 0
    [460, "inset(0 50% 0 0)"], //   (720 - 460) / (720 - 200) = 0.5
    [200, "inset(0 0% 0 0)"], //    progress 1
    [-5000, "inset(0 0% 0 0)"], //  progress > 1 clamps to 1
  ];
  for (const [top, clip] of cases) {
    const w = new FillScene({ top, vh: 800 });
    w.runOriginal();
    same(w.log, [`@0 fill.style.clipPath=${clip}`], `top=${top}`);
  }
});

test("W5 original: scroll events are throttled to one write per animation frame; resize behaves the same", () => {
  const w = new FillScene({ top: 1000 });
  w.runOriginal();
  w.log.length = 0;
  w.apply({ op: "top", v: 460 });
  w.apply({ op: "scroll" });
  w.apply({ op: "scroll" });
  w.apply({ op: "scroll" });
  same(w.log, [], "nothing is written before the frame");
  assert.equal(w.resources().frames, 1, "one frame queued for three scrolls");
  w.apply({ op: "frame" });
  same(w.log, ["@0 fill.style.clipPath=inset(0 50% 0 0)"]);
  w.apply({ op: "resize", height: 400 }); // start = 360, end = 100 -> (360-460)/260 < 0
  w.apply({ op: "frame" });
  assert.equal(w.log.at(-1), "@0 fill.style.clipPath=inset(0 100% 0 0)");
});

test("W5 original: reduced motion registers nothing and writes nothing; listeners are scroll(passive) then resize(no options)", () => {
  const still = new FillScene({ reduceMotion: true });
  still.runOriginal();
  same(still.log, []);
  same(still.listenerRegistrations, []);

  const w = new FillScene({});
  w.runOriginal();
  same(w.listenerRegistrations, ['scroll:{"passive":true}', "resize:none"]);
  assert.equal(w.resources().scroll, 1);
  assert.equal(w.resources().resize, 1);
});

test("W5 original quirk: innerHeight 0 gives NaN (0/0) and writes 'inset(0 NaN% 0 0)'", () => {
  const w = new FillScene({ top: 0, vh: 0 });
  w.runOriginal();
  same(w.log, ["@0 fill.style.clipPath=inset(0 NaN% 0 0)"]);
});

// ---------------------------------------------------------------- W1 original (index.html:2301-2356)

const focus = (i: number): Step => ({ op: "rect", i, top: 96, bottom: 700 }); // top <= 98 && bottom > 136
const unfocus = (i: number): Step => ({ op: "rect", i, top: 2000 + i * 600, bottom: 2600 + i * 600 });

test("W1 original: after 100 ms only the focused card's video plays (muted first); the previous one is paused", () => {
  const w = new PlaybackScene({ cards: 4 });
  w.runOriginal();
  w.apply({ op: "advance", ms: 100 });
  same(w.log, [], "nothing focused: the first update is a no-op (focus -1 equals the initial -1)");

  w.apply(focus(1));
  w.apply({ op: "scroll" });
  w.apply({ op: "frame" });
  same(w.log, ["@100 video[1].muted=true", "@100 video[1].play()"]);

  w.log.length = 0;
  w.apply(unfocus(1));
  w.apply(focus(2));
  w.apply({ op: "scroll" });
  w.apply({ op: "frame" });
  same(w.log, ["@100 video[1].pause()", "@100 video[2].muted=true", "@100 video[2].play()"]);
});

test("W1 original: the focused index is the LAST card that satisfies top <= 98 and bottom > 136 (boundaries included)", () => {
  const w = new PlaybackScene({ cards: 3 });
  w.runOriginal();
  w.apply({ op: "advance", ms: 100 });
  // card 0 and card 1 both qualify -> the last one (1) wins
  w.apply({ op: "rect", i: 0, top: -400, bottom: 300 });
  w.apply({ op: "rect", i: 1, top: 98, bottom: 137 });
  w.apply({ op: "scroll" });
  w.apply({ op: "frame" });
  same(w.log, ["@100 video[1].muted=true", "@100 video[1].play()"]);
  // just outside both limits: top 99 and bottom 136
  w.log.length = 0;
  w.apply({ op: "rect", i: 1, top: 99, bottom: 700 });
  w.apply({ op: "scroll" });
  w.apply({ op: "frame" });
  same(w.log, ["@100 video[0].muted=true", "@100 video[0].play()", "@100 video[1].pause()"], "the loop goes by index: card 0 plays first, then card 1 (playing) is paused");
  w.log.length = 0;
  w.apply({ op: "rect", i: 0, top: -400, bottom: 136 });
  w.apply({ op: "scroll" });
  w.apply({ op: "frame" });
  same(w.log, ["@100 video[0].pause()"], "no card qualifies: everything playing is paused, nothing plays");
});

test("W1 original: an unchanged focus does nothing (a manually paused focused video stays paused)", () => {
  const w = new PlaybackScene({ cards: 2 });
  w.runOriginal();
  w.apply({ op: "advance", ms: 100 });
  w.apply(focus(0));
  w.apply({ op: "scroll" });
  w.apply({ op: "frame" });
  w.videos[0]?.pause();
  w.log.length = 0;
  w.apply({ op: "scroll" });
  w.apply({ op: "frame" });
  same(w.log, []);
});

test("W1 original: safety net - when the user plays a video, every other playing video is paused", () => {
  const w = new PlaybackScene({ cards: 3 });
  w.runOriginal();
  w.apply({ op: "advance", ms: 100 });
  w.apply(focus(1));
  w.apply({ op: "scroll" });
  w.apply({ op: "frame" });
  w.log.length = 0;
  w.apply({ op: "userPlay", i: 0 });
  same(w.log, ["@100 video[0].userPlay", "@100 video[1].pause()"]);
  assert.equal(w.videos[0]?.paused, false);
  assert.equal(w.videos[1]?.paused, true);
});

test("W1 original: a rejected play() is swallowed (no unhandled rejection) and the video stays paused", async () => {
  const w = new PlaybackScene({ cards: 2, playOutcome: "reject" });
  w.runOriginal();
  w.apply({ op: "advance", ms: 100 });
  w.apply(focus(0));
  w.apply({ op: "scroll" });
  w.apply({ op: "frame" });
  await new Promise((r) => setImmediate(r)); // would surface an unhandledRejection
  same(w.log, ["@100 video[0].muted=true", "@100 video[0].play()"]);
  assert.equal(w.videos[0]?.paused, true);
});

test("W1 original: a card without <video> is skipped; zero cards registers NOTHING (not even the safety net)", () => {
  const w = new PlaybackScene({ cards: 3, noVideo: [1] });
  w.runOriginal();
  w.apply({ op: "advance", ms: 100 });
  w.apply(focus(1));
  w.apply({ op: "scroll" });
  w.apply({ op: "frame" });
  same(w.log, [], "card 1 is focused but has no video");

  const none = new PlaybackScene({ cards: 0 });
  none.runOriginal();
  same(none.listenerRegistrations, []);
  same(none.resources(), { ...none.resources(), scroll: 0, resize: 0, timers: 0, playListeners: 0 });
});

test("W1 original: listeners are scroll(passive) then resize(no options); the first update is scheduled at 100 ms", () => {
  const w = new PlaybackScene({ cards: 2 });
  w.runOriginal();
  same(w.listenerRegistrations, ['scroll:{"passive":true}', "resize:none"]);
  assert.equal(w.resources().timers, 1);
  assert.equal(w.resources().playListeners, 2, "one 'play' listener per <video> of the page");
});

// ---------------------------------------------------------------- W2/W7 original (index.html:2358-2629)

test("W2 original: click -> 3,2,1 every 700 ms, boom path at 2050, shake off at 2550, projects revealed at 4250", () => {
  const w = new CategoryScene({ audio: "none", explode: true, cards: 4 });
  w.runOriginal();
  same(w.log, ["@0 io.new threshold=0", "@0 io.observe(section[0])"]);
  w.log.length = 0;
  w.apply({ op: "click" });
  w.apply({ op: "advance", ms: 4250 });
  const tick = (t: number, n: number): string[] => [
    `@${t} countdown[0].textContent=${n}`,
    `@${t} countdown[0].class.add(show)`,
    `@${t} countdown[0].class.remove(pulse)`,
    `@${t} countdown[0].offsetWidth(reflow)`,
    `@${t} countdown[0].class.add(pulse)`,
  ];
  same(w.log, [
    "@0 cover[0].dataset.done=1",
    "@0 cta[0].style.opacity=0",
    "@0 bomb[0].style.opacity=0",
    ...tick(0, 3),
    ...tick(700, 2),
    ...tick(1400, 1),
    "@2050 countdown[0].class.remove(show)",
    "@2050 flash[0].class.remove(active)",
    "@2050 flash[0].offsetWidth(reflow)",
    "@2050 flash[0].class.add(active)",
    "@2050 cover[0].class.add(shake)",
    "@2050 explode(cover[0])",
    "@2550 cover[0].class.remove(shake)",
    "@4250 cover[0].style.display=none",
    "@4250 projects[0].style.display=",
    ...[0, 1, 2, 3].flatMap((j) => [
      `@4250 card[0.${j}].class.remove(fly-in)`,
      `@4250 card[0.${j}].offsetWidth(reflow)`,
      `@4250 card[0.${j}].style.animationDelay=${j * 0.08}s`,
      `@4250 card[0.${j}].class.add(fly-in)`,
    ]),
  ]);
  same(w.resources().timers, 0, "nothing left pending");
});

test("W2 original: a second click while detonated does nothing (dataset.done guard)", () => {
  const w = new CategoryScene({});
  w.runOriginal();
  w.apply({ op: "click" });
  w.apply({ op: "advance", ms: 1000 });
  w.log.length = 0;
  w.apply({ op: "click" });
  same(w.log, []);
});

test("W2 original quirk: a missing .cat-countdown throws a TypeError on click (after done/cta/bomb were written)", () => {
  const w = new CategoryScene({ missing: ["countdown"] });
  w.runOriginal();
  w.log.length = 0;
  assert.throws(() => w.apply({ op: "click" }), { name: "TypeError" }); // vm realm: compare by name, not instanceof
  same(w.log, ["@0 cover[0].dataset.done=1", "@0 cta[0].style.opacity=0", "@0 bomb[0].style.opacity=0"]);
});

test("W2 original: missing cta/bomb/flash/projects are tolerated (guards), the cover is still hidden at 4250", () => {
  const w = new CategoryScene({ missing: ["cta", "bomb", "flash", "projects"] });
  w.runOriginal();
  w.apply({ op: "click" });
  w.apply({ op: "advance", ms: 4250 });
  assert.equal(w.lines(/cta|bomb|flash|projects|card/).length, 0);
  assert.ok(w.log.includes("@4250 cover[0].style.display=none"));
});

test("W2 original: the explosion stub returning false takes the DOM fallback path (W3), not the stub path", () => {
  const w = new CategoryScene({ explode: false });
  w.runOriginal();
  w.apply({ op: "click" });
  w.apply({ op: "advance", ms: 2050 });
  assert.ok(w.log.includes("@2050 explode(cover[0])"));
  assert.ok(w.lines(/particles\[0\]|appendChild/).length > 0, "spawnParticles / blackout wrote into .explosion-particles");
});

test("W7 original: resetCategory via the IntersectionObserver (not intersecting AND top > 0 AND done)", () => {
  const w = new CategoryScene({});
  w.runOriginal();
  w.markDone(0);
  w.log.length = 0;
  w.apply({ op: "io", isIntersecting: true, top: 120 });
  w.apply({ op: "io", isIntersecting: false, top: 0 });
  w.apply({ op: "io", isIntersecting: false, top: -300 });
  same(w.log, [], "intersecting, or not below the viewport: nothing");
  w.apply({ op: "io", isIntersecting: false, top: 120 });
  same(w.log, [
    "@0 projects[0].style.display=none",
    "@0 cover[0].style.display=",
    "@0 cover[0].dataset.done=",
    "@0 cta[0].style.opacity=",
    "@0 bomb[0].style.opacity=",
    "@0 countdown[0].class.remove(show,pulse)",
  ]);
  w.log.length = 0;
  w.apply({ op: "io", isIntersecting: false, top: 120 });
  same(w.log, [], "done is now '' (falsy): a second event does nothing");
});

test("W7 original: with several categories the observer resets only the section whose cover is done", () => {
  const w = new CategoryScene({ cats: ["social", "ads"] });
  w.runOriginal();
  same(w.log, ["@0 io.new threshold=0", "@0 io.observe(section[0])", "@0 io.observe(section[1])"]);
  w.markDone(1);
  w.log.length = 0;
  w.apply({ op: "io", cat: 0, isIntersecting: false, top: 50 });
  same(w.log, []);
  w.apply({ op: "io", cat: 1, isIntersecting: false, top: 50 });
  assert.ok(w.log.includes("@0 projects[1].style.display=none"));
});

// ---------------------------------------------------------------- W4 original (index.html:2359-2407)

test("W4 original: playTick writes exactly this node graph and creates the context lazily, once", () => {
  const w = new CategoryScene({ audio: "standard" });
  const o = w.runOriginal();
  w.log.length = 0;
  o.playTick(660);
  same(w.log, [
    "@0 audio.new#1",
    "@0 a1.createOscillator() -> a1.osc1",
    "@0 a1.createGain() -> a1.gain2",
    "@0 a1.osc1.type=sine",
    "@0 a1.osc1.frequency.value=660",
    "@0 a1.gain2.gain.setValueAtTime(0.18,0)",
    "@0 a1.gain2.gain.exponentialRampToValueAtTime(0.001,0.16)",
    "@0 a1.osc1.connect(a1.gain2)",
    "@0 a1.gain2.connect(a1.destination)",
    "@0 a1.osc1.start()",
    "@0 a1.osc1.stop(0.16)",
  ]);
  w.log.length = 0;
  o.playTick(740);
  assert.equal(w.audioContexts.length, 1, "the context is reused");
  assert.ok(!w.log.includes("@0 audio.new#1") && !w.log.some((l) => l.includes("audio.new")), "no second context");
  same(w.soundLog, [{ t: 0, kind: "tick", freq: 660 }, { t: 0, kind: "tick", freq: 740 }]);
});

test("W4 original: playBoom builds a 0.6 s noise buffer + lowpass sweep + 140->28 Hz sine, deterministic for a seed", () => {
  const run = (seed: number): string[] => {
    const w = new CategoryScene({ audio: "standard", seed });
    const o = w.runOriginal();
    o.playBoom();
    return w.log;
  };
  const a = run(1);
  same(a, run(1), "same seed, same noise (Math.random is the injected generator)");
  assert.notDeepStrictEqual(a, run(2), "another seed changes the noise checksum");
  assert.ok(a.includes("@0 a1.createBuffer(1,26460,44100)"), "floor(44100 * 0.6)");
  assert.ok(a.includes("@0 a1.biquad3.type=lowpass") || a.some((l) => /biquad\d+\.type=lowpass/.test(l)));
  assert.ok(a.some((l) => /biquad\d+\.frequency\.setValueAtTime\(3200,0\)/.test(l)));
  assert.ok(a.some((l) => /biquad\d+\.frequency\.exponentialRampToValueAtTime\(90,0\.6\)/.test(l)));
  assert.ok(a.some((l) => /osc\d+\.frequency\.setValueAtTime\(140,0\)/.test(l)));
  assert.ok(a.some((l) => /osc\d+\.frequency\.exponentialRampToValueAtTime\(28,0\.5\)/.test(l)));
  assert.ok(a.some((l) => /osc\d+\.stop\(0\.5\)/.test(l)));
});

test("W4 original: a click drives tick 660/740/830 at 0/700/1400 and the boom at 2050 (soundLog)", () => {
  const w = new CategoryScene({ audio: "standard" });
  w.runOriginal();
  w.apply({ op: "click" });
  w.apply({ op: "advance", ms: 2050 });
  same(w.soundLog, [
    { t: 0, kind: "tick", freq: 660 },
    { t: 700, kind: "tick", freq: 740 },
    { t: 1400, kind: "tick", freq: 830 },
    { t: 2050, kind: "boom" },
  ]);
  assert.equal(w.audioContexts.length, 1);
});

test("W4 original: suspended contexts are resumed on every play; webkit prefix works; failures are swallowed and retried", () => {
  const s = new CategoryScene({ audio: "suspended" });
  const so = s.runOriginal();
  so.playTick(660);
  so.playTick(660);
  assert.equal(s.lines(/a1\.resume\(\)/).length, 2);

  const k = new CategoryScene({ audio: "webkit" });
  k.runOriginal().playTick(660);
  assert.equal(k.audioContexts.length, 1);

  for (const mode of ["none", "throws"] as const) {
    const f = new CategoryScene({ audio: mode });
    const fo = f.runOriginal();
    assert.doesNotThrow(() => {
      fo.playTick(660);
      fo.playBoom();
    }, mode);
    same(f.log.filter((l) => !l.startsWith("@0 io.")), [], mode);
    assert.equal(f.audioContexts.length, 0, mode);
  }
});

// ---------------------------------------------------------------- compareRuns itself

test("compareRuns: the original compared with itself in two worlds is identical (all three scenes)", () => {
  compareRuns({
    make: () => new FillScene({ top: 900 }),
    original: (s) => s.runOriginal(),
    port: (s) => s.runOriginal(),
    steps: [{ op: "top", v: 600 }, { op: "scroll" }, { op: "resize", height: 500 }, { op: "top", v: 100 }, { op: "scroll" }],
  });
  compareRuns({
    make: () => new PlaybackScene({ cards: 3 }),
    original: (s) => s.runOriginal(),
    port: (s) => s.runOriginal(),
    autoFrame: false,
    steps: [{ op: "advance", ms: 100 }, focus(1), { op: "scroll" }, { op: "advance", ms: 32 }, { op: "userPlay", i: 0 }],
  });
  compareRuns({
    make: () => new CategoryScene({ audio: "standard", cards: 3 }),
    original: (s) => s.runOriginal(),
    port: (s) => {
      s.runOriginal();
    },
    autoFrame: false,
    steps: [{ op: "click" }, { op: "advance", ms: 5000 }, { op: "io", isIntersecting: false, top: 10 }],
  });
});

test("compareRuns: a port that does nothing is reported as different (after mount / after a step)", () => {
  const mk = () => new FillScene({ top: 900 });
  assert.throws(
    () => compareRuns({ make: mk, original: (s) => s.runOriginal(), port: () => {}, steps: [] }),
    /log differs after mount/,
  );
  assert.throws(
    () =>
      compareRuns({
        make: () => new CategoryScene({}),
        original: (s) => s.runOriginal(),
        port: () => {}, // port mounted nothing: the IntersectionObserver lines are missing right away
        steps: [{ op: "click" }],
      }),
    /log differs after mount/,
  );
});

test("compareRuns: 'do' steps run the original-side or the ported-side function on the right world", () => {
  const calls: string[] = [];
  compareRuns({
    make: () => new FillScene({ top: 900 }),
    original: (s) => s.runOriginal(),
    port: (s) => s.runOriginal(),
    steps: [{ op: "do", label: "side check", original: () => calls.push("original"), ported: () => calls.push("ported") }],
  });
  same(calls, ["original", "ported"]);
});
