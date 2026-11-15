// STATUS: UNVERIFIED (Claude draft; run in the cloud sandbox only, not yet on the owner's machine)
/**
 * W1 parity: lib/works/playback.ts against the verbatim v4 block (tests/fixtures/works-original-playback.js,
 * site/index.html:2301-2356), step by step, in the fake world of tests/helpers/works-harness.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { PlaybackScene, compareRuns, same, type PlaybackOpts, type Step } from "./helpers/works-harness";
import { mountPlayback } from "../lib/works/playback";

const focus = (i: number, top = 96, bottom = 700): Step => ({ op: "rect", i, top, bottom });
const away = (i: number): Step => ({ op: "rect", i, top: 2000 + i * 600, bottom: 2600 + i * 600 });
const frame: Step = { op: "advance", ms: 16 };

function parity(opts: PlaybackOpts, steps: Step[]) {
  const r = compareRuns({
    make: () => new PlaybackScene(opts),
    original: (w) => w.runOriginal(),
    port: (w) => mountPlayback(w.env()),
    steps,
    autoFrame: false,
  });
  same(r.ported.listenerRegistrations, r.original.listenerRegistrations, "same listeners, same options");
  same(r.ported.resources(), r.original.resources(), "same live resources");
  return r;
}

test("registration: scroll passive, resize without options, in that order", () => {
  const r = parity({}, []);
  same(r.ported.listenerRegistrations, ['scroll:{"passive":true}', "resize:none"]);
  same(r.ported.resources().playListeners, 4);
});

test("first update runs at t=100 without any scroll (nothing focused: no calls at all)", () => {
  const r = parity({ cards: 3 }, [{ op: "advance", ms: 99 }, { op: "advance", ms: 1 }, { op: "advance", ms: 500 }]);
  same(r.ported.lines(/video/).length, 0);
});

test("first update at t=100 focuses a card that is already in place", () => {
  const r = parity({ cards: 3 }, [focus(1), { op: "advance", ms: 100 }]);
  assert.ok(r.ported.lines(/muted/).length === 1, "muted written once");
  assert.ok(r.ported.lines(/play\(\)/).length === 1, "play called once");
});

test("focus walks through every card and back, then nothing is focused", () => {
  const steps: Step[] = [{ op: "advance", ms: 100 }];
  for (let i = 0; i < 4; i++) steps.push(focus(i), { op: "scroll" }, frame, away(i));
  for (let i = 3; i >= 0; i--) steps.push(focus(i), { op: "scroll" }, frame, away(i));
  steps.push({ op: "scroll" }, frame);
  parity({ cards: 4 }, steps);
});

test("same focused card twice changes nothing (lastFocused cache)", () => {
  const r = parity({ cards: 3 }, [focus(1), { op: "scroll" }, frame, { op: "scroll" }, frame, { op: "resize", height: 500 }, frame]);
  same(r.ported.lines(/muted/).length, 1);
});

test("moving focus pauses the playing card and plays the new one", () => {
  const r = parity({ cards: 3 }, [focus(0), { op: "scroll" }, frame, away(0), focus(1), { op: "scroll" }, frame]);
  assert.ok(r.ported.lines(/pause/).length >= 1);
});

test("going from a focused card to none pauses everything playing and plays nothing", () => {
  parity({ cards: 3 }, [focus(2), { op: "scroll" }, frame, away(2), { op: "scroll" }, frame]);
});

test("cards without a <video> are skipped silently", () => {
  parity({ cards: 4, noVideo: [1, 3] }, [focus(1), { op: "scroll" }, frame, away(1), focus(3), { op: "scroll" }, frame, away(3), focus(0), { op: "scroll" }, frame]);
});

test("a rejected play() neither throws nor stops later updates", async () => {
  const r = parity({ cards: 2, playOutcome: "reject" }, [focus(0), { op: "scroll" }, frame, away(0), focus(1), { op: "scroll" }, frame]);
  await new Promise((res) => setImmediate(res));
  assert.ok(r.ported.lines(/play\(\)/).length >= 2);
});

test("safety net: when the user starts a video, every other playing video is paused", () => {
  parity({ cards: 3 }, [focus(0), { op: "scroll" }, frame, { op: "userPlay", i: 1 }, frame, { op: "userPlay", i: 2 }, frame, { op: "userPlay", i: 0 }, frame]);
});

test("zero cards: nothing at all is registered, not even the safety net", () => {
  const r = parity({ cards: 0 }, [{ op: "scroll" }, { op: "resize", height: 300 }, { op: "advance", ms: 200 }]);
  same(r.ported.listenerRegistrations, []);
  same(r.ported.resources().timers, 0);
  same(r.ported.log, []);
});

test("throttling: many events before the frame cause one update; ignored while a frame is queued", () => {
  parity({ cards: 3 }, [focus(1), { op: "scroll" }, { op: "scroll" }, { op: "resize", height: 700 }, { op: "scroll" }, frame, away(1), focus(2), { op: "scroll" }, { op: "scroll" }, frame]);
});

test("rects are read when the frame runs, not when the event fires", () => {
  parity({ cards: 3 }, [away(0), focus(2), { op: "scroll" }, away(2), focus(1), frame]);
});

test("resize path updates like scroll", () => {
  parity({ cards: 2 }, [focus(1), { op: "resize", height: 640 }, frame, away(1), focus(0), { op: "resize", width: 500 }, frame]);
});

test("a single card", () => {
  parity({ cards: 1 }, [{ op: "advance", ms: 100 }, focus(0), { op: "scroll" }, frame, away(0), { op: "scroll" }, frame]);
});

test("unmount releases everything and nothing is written afterwards (DEVIATION: the original never cleans up)", () => {
  const r = compareRuns({
    make: () => new PlaybackScene({ cards: 3 }),
    original: (w) => w.runOriginal(),
    port: (w) => mountPlayback(w.env()),
    steps: [focus(1), { op: "scroll" }, frame],
    autoFrame: false,
  });
  const w = r.ported;
  r.unmount?.();
  same(w.resources().scroll, 0);
  same(w.resources().resize, 0);
  same(w.resources().playListeners, 0);
  same(w.resources().timers, 0);
  same(w.resources().frames, 0);
  w.log.length = 0;
  w.apply(away(1));
  w.apply(focus(2));
  w.apply({ op: "scroll" });
  w.apply({ op: "advance", ms: 300 });
  w.apply({ op: "userPlay", i: 0 });
  same(w.log.filter((l) => /muted|pause|play\(\)/.test(l) && !/userPlay/.test(l)).length, 0);
  assert.doesNotThrow(() => r.unmount?.());
});

test("unmount before the first update cancels the 100 ms timer and a queued frame", () => {
  const w = new PlaybackScene({ cards: 3 });
  const unmount = mountPlayback(w.env());
  w.apply(focus(0));
  w.apply({ op: "scroll" });
  same(w.resources().frames, 1);
  same(w.resources().timers, 1);
  unmount();
  same(w.resources().frames, 0);
  same(w.resources().timers, 0);
  w.apply({ op: "advance", ms: 500 });
  same(w.log.filter((l) => /muted|play\(\)/.test(l)).length, 0);
});

test("unmount of a zero-card mount is a harmless no-op", () => {
  const w = new PlaybackScene({ cards: 0 });
  const unmount = mountPlayback(w.env());
  assert.doesNotThrow(() => {
    unmount();
    unmount();
  });
});

// ---------------------------------------------------------------- mutants

type Knobs = { cache?: boolean; net?: boolean; offset?: number; mute?: boolean };
function mutant(w: PlaybackScene, k: Knobs): () => void {
  const { win, cards, allVideos } = w.env();
  let last = -1;
  const update = (): void => {
    let focused = -1;
    for (let i = cards.length - 1; i >= 0; i--) {
      const r = cards[i].getBoundingClientRect();
      if (r.top <= 96 + (k.offset ?? 2) && r.bottom > 96 + 40) {
        focused = i;
        break;
      }
    }
    if (k.cache !== false && focused === last) return;
    last = focused;
    cards.forEach((c, i) => {
      const v = c.video();
      if (!v) return;
      if (i === focused) {
        if (k.mute !== false) v.muted = true;
        v.play().catch(() => {});
      } else if (!v.paused) v.pause();
    });
  };
  win.addEventListener("scroll", () => win.requestAnimationFrame(update), { passive: true });
  win.addEventListener("resize", () => win.requestAnimationFrame(update));
  win.setTimeout(update, 100);
  if (k.net !== false) allVideos.forEach((v) => v.addEventListener("play", () => allVideos.forEach((o) => { if (o !== v && !o.paused) o.pause(); })));
  return () => {};
}
const run = (k: Knobs, steps: Step[]) => () =>
  compareRuns({ make: () => new PlaybackScene({ cards: 3 }), original: (w) => w.runOriginal(), port: (w) => mutant(w, k), steps, autoFrame: false });

test("mutants: missing cache, missing safety net, wrong threshold and missing mute are all reported", () => {
  const steps: Step[] = [focus(1), { op: "scroll" }, frame, { op: "scroll" }, frame, { op: "userPlay", i: 0 }, frame, { op: "userPlay", i: 2 }, frame, away(1), focus(2, 98), { op: "scroll" }, frame];
  assert.doesNotThrow(run({}, steps), "the mutant with no defect behaves like the original (sanity)");
  assert.throws(run({ cache: false }, steps), /log differs/);
  assert.throws(run({ net: false }, steps), /log differs/);
  assert.throws(run({ mute: false }, steps), /log differs/);
  assert.throws(run({ offset: 1 }, [focus(0, 98), { op: "scroll" }, frame]), /log differs/);
});
