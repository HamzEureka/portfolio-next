// STATUS: UNVERIFIED (DeepSeek draft, reviewed by Claude; independent second suite, run in the cloud sandbox only)
/**
 * W1 parity: lib/works/playback.ts against the verbatim v4 block
 * (tests/fixtures/works-original-playback.js, site/index.html:2301-2356), plus the
 * focus helper's boundaries through the mount.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  PlaybackScene,
  compareRuns,
  same,
  type PlaybackOpts,
  type Step,
} from "./helpers/works-harness";
import { mountPlayback } from "../lib/works/playback";
import { STICKY_TOP } from "../lib/works/focus";

const mount = (w: PlaybackScene) => mountPlayback(w.env());

/** v4-rect for a focused card; STICKY_TOP keeps both literals in range. */
const focus = (i: number, top: number = STICKY_TOP, bottom: number = 700): Step => ({
  op: "rect",
  i,
  top,
  bottom,
});
const away = (i: number): Step => ({ op: "rect", i, top: 2000 + i * 600, bottom: 2600 + i * 600 });

function parity(opts: PlaybackOpts, steps: Step[] = []) {
  const r = compareRuns({
    make: () => new PlaybackScene(opts),
    original: (w) => w.runOriginal(),
    port: mount,
    steps,
    autoFrame: false,
  });
  same(r.ported.listenerRegistrations, r.original.listenerRegistrations, "same listeners, same options");
  same(r.ported.resources(), r.original.resources(), "same live resources");
  return r;
}

// ---------------------------------------------------------------- initial update / smoke

test("initial update at t=100 runs even without a scroll", () => {
  const r = parity({ cards: 4 }, [
    away(0), away(2), away(3), focus(1),
    { op: "advance", ms: 100 },
  ]);
  assert.ok(r.ported.lines(/video/).length > 0, "the 100 ms timer ran update and touched video 1");
});

test("smoke W1: playback parity over a scenario", () => {
  const r = compareRuns({
    make: () => new PlaybackScene({ cards: 4, noVideo: [3] }),
    original: (w) => w.runOriginal(),
    port: (w) => mountPlayback(w.env()),
    autoFrame: false,
    steps: [
      { op: "advance", ms: 100 },
      focus(1), { op: "scroll" }, { op: "advance", ms: 16 },
      away(1), focus(2), { op: "resize", height: 700 }, { op: "advance", ms: 16 },
      { op: "userPlay", i: 0 }, { op: "advance", ms: 16 },
      focus(3), { op: "scroll" }, { op: "advance", ms: 16 },
      away(2), away(3), { op: "scroll" }, { op: "advance", ms: 16 },
    ],
  });
  same(r.ported.listenerRegistrations, r.original.listenerRegistrations);
  same(r.ported.resources(), r.original.resources());
  r.unmount?.();
  same(r.ported.resources().scroll, 0);
  same(r.ported.resources().playListeners, 0);
});

// ---------------------------------------------------------------- focus movement

test("focus moves through all cards and back, pausing the previous one", () => {
  const steps: Step[] = [
    away(0), away(1), away(2), away(3),
    { op: "advance", ms: 100 },
  ];
  for (let i = 0; i < 4; i++) {
    if (i > 0) steps.push(away(i - 1));
    steps.push(focus(i), { op: "scroll" }, { op: "advance", ms: 16 });
  }
  for (let i = 3; i >= 0; i--) {
    if (i < 3) steps.push(away(i + 1));
    steps.push(focus(i), { op: "scroll" }, { op: "advance", ms: 16 });
  }
  const r = parity({ cards: 4 }, steps);
  assert.ok(r.ported.lines(/video/).length > 0, "video writes were compared");
});

test("going to no focus (-1) pauses every playing video and plays none", () => {
  parity({ cards: 3 }, [
    away(0), away(1), focus(2),
    { op: "advance", ms: 100 },
    away(2),
    { op: "scroll" }, { op: "advance", ms: 16 },
  ]);
});

test("lastFocused cache: a second update with the same focus does nothing", () => {
  const r = parity({ cards: 2 }, [
    away(0), away(1),
    { op: "advance", ms: 100 },
    focus(1), { op: "scroll" }, { op: "advance", ms: 16 },
    { op: "scroll" }, { op: "advance", ms: 16 }, // same focus: nothing
    { op: "resize", height: 700 }, { op: "advance", ms: 16 }, // same focus: nothing
  ]);
  same(
    r.ported.lines(/video\[1\]/).length,
    r.original.lines(/video\[1\]/).length,
    "video 1 written only once",
  );
});

test("cards without a <video> are skipped silently", () => {
  parity({ cards: 4, noVideo: [1, 3] }, [
    away(0), away(1), away(2), away(3),
    { op: "advance", ms: 100 },
    focus(0), { op: "scroll" }, { op: "advance", ms: 16 },
    away(0), focus(1), { op: "scroll" }, { op: "advance", ms: 16 }, // no video on 1
    away(1), focus(2), { op: "scroll" }, { op: "advance", ms: 16 },
    away(2), focus(3), { op: "scroll" }, { op: "advance", ms: 16 }, // no video on 3
  ]);
});

test("a rejected play() is swallowed: no throw, no unhandled rejection", () => {
  const r = parity({ cards: 3, playOutcome: "reject" }, [
    away(0), away(1), away(2),
    { op: "advance", ms: 100 },
    focus(0), { op: "scroll" }, { op: "advance", ms: 16 },
    away(0), focus(2), { op: "scroll" }, { op: "advance", ms: 16 },
  ]);
  assert.ok(r.ported.lines(/video/).length > 0);
});

// ---------------------------------------------------------------- safety net / throttling / resize

test("userPlay safety net: starting one video pauses the other playing ones", () => {
  parity({ cards: 4 }, [
    away(0), away(1), away(2), away(3),
    { op: "advance", ms: 100 },
    focus(0), { op: "scroll" }, { op: "advance", ms: 16 },
    { op: "userPlay", i: 2 }, { op: "advance", ms: 16 }, // pauses video 0
    { op: "userPlay", i: 1 }, { op: "advance", ms: 16 }, // pauses video 2
  ]);
});

test("throttling: many scrolls before one frame queue one update", () => {
  const r = parity({ cards: 4 }, [
    away(0), away(1), away(2), away(3),
    { op: "advance", ms: 100 },
    focus(1), { op: "scroll" }, { op: "scroll" }, { op: "scroll" },
    { op: "advance", ms: 16 },
  ]);
  same(r.ported.lines(/video/).length, r.original.lines(/video/).length);
});

test("resize uses the same throttled update path", () => {
  parity({ cards: 3 }, [
    away(0), away(1), away(2),
    { op: "advance", ms: 100 },
    focus(2), { op: "resize", height: 700 }, { op: "advance", ms: 16 },
  ]);
});

// ---------------------------------------------------------------- zero cards

test("zero cards: nothing is registered (no listeners, no timers, no play listeners)", () => {
  const r = compareRuns({
    make: () => new PlaybackScene({ cards: 0 }),
    original: (w) => w.runOriginal(),
    port: mount,
    steps: [],
    autoFrame: false,
  });
  same(r.ported.listenerRegistrations, []);
  same(r.ported.resources(), r.original.resources());
});

// ---------------------------------------------------------------- unmount (DEVIATION)

test("unmount releases every live resource and silences later events", () => {
  const w = new PlaybackScene({ cards: 4 });
  const unmount = mount(w);
  w.apply({ op: "advance", ms: 100 });
  w.apply({ op: "rect", i: 1, top: STICKY_TOP, bottom: 700 });
  w.apply({ op: "scroll" });
  same(w.resources().frames, 1, "one frame is queued before unmount");
  unmount();
  same(w.resources().scroll, 0);
  same(w.resources().resize, 0);
  same(w.resources().frames, 0);
  same(w.resources().timers, 0);
  same(w.resources().playListeners, 0);
  w.log.length = 0;
  w.apply({ op: "scroll" });
  w.apply({ op: "resize", height: 500 });
  w.apply({ op: "advance", ms: 16 });
  same(w.log, []);
});

test("unmount twice is harmless", () => {
  const w = new PlaybackScene({ cards: 4 });
  const unmount = mount(w);
  assert.doesNotThrow(() => {
    unmount();
    unmount();
  });
});

test("unmount of a zero-card mount is a harmless no-op", () => {
  const w = new PlaybackScene({ cards: 0 });
  const unmount = mount(w);
  assert.doesNotThrow(() => {
    unmount();
    unmount();
  });
});

// ---------------------------------------------------------------- the comparison has teeth

/** A deliberately wrong port; each knob breaks one thing the real port must keep. */
function mutant(
  w: PlaybackScene,
  m: { sticky?: number; noCache?: boolean; noSafety?: boolean },
): () => void {
  const { win, cards, allVideos } = w.env();
  if (cards.length === 0) return () => {};
  const STICKY = m.sticky ?? 96;
  let ticking = false;
  let lastFocused = -1;

  const update = (): void => {
    ticking = false;
    let focused = -1;
    for (let i = cards.length - 1; i >= 0; i--) {
      const rect = cards[i].getBoundingClientRect();
      if (rect.top <= STICKY + 2 && rect.bottom > STICKY + 40) {
        focused = i;
        break;
      }
    }
    if (!m.noCache && focused === lastFocused) return;
    lastFocused = focused;
    cards.forEach((card, i) => {
      const video = card.video();
      if (!video) return;
      if (i === focused) {
        video.muted = true;
        video.play().catch(() => {});
      } else if (!video.paused) {
        video.pause();
      }
    });
  };

  const onScroll = (): void => {
    if (!ticking) {
      win.requestAnimationFrame(update);
      ticking = true;
    }
  };

  win.addEventListener("scroll", onScroll, { passive: true });
  win.addEventListener("resize", onScroll);
  win.setTimeout(update, 100);

  if (!m.noSafety) {
    for (const video of allVideos) {
      video.addEventListener("play", () => {
        for (const v of allVideos) {
          if (v !== video && !v.paused) v.pause();
        }
      });
    }
  }

  return () => {};
}

const mutantSteps: Step[] = [
  away(0), away(1), away(2), away(3),
  { op: "advance", ms: 100 },
  focus(1), { op: "scroll" }, { op: "advance", ms: 16 },            // focus 1, video 1 plays
  focus(1), { op: "scroll" }, { op: "advance", ms: 16 },            // cache test
  focus(2, 99, 141), { op: "scroll" }, { op: "advance", ms: 16 },   // sticky boundary
  focus(3), { op: "scroll" }, { op: "advance", ms: 16 },            // focus 3
  { op: "userPlay", i: 0 }, { op: "advance", ms: 16 },              // safety test
];

const runMutant = (m: Parameters<typeof mutant>[1], steps: Step[]) => () =>
  compareRuns({
    make: () => new PlaybackScene({ cards: 4 }),
    original: (w) => w.runOriginal(),
    port: (w) => mutant(w, m),
    steps,
    autoFrame: false,
  });

test("mutants: wrong STICKY offset, missing lastFocused cache and missing safety net are all rejected", () => {
  assert.doesNotThrow(runMutant({}, mutantSteps), "baseline mutant is faithful (sanity)");
  assert.throws(runMutant({ sticky: 100 }, mutantSteps), /log differs/);
  assert.throws(runMutant({ noCache: true }, mutantSteps), /log differs/);
  assert.throws(runMutant({ noSafety: true }, mutantSteps), /log differs/);
});
