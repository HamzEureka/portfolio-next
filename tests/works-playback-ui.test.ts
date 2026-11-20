// STATUS: UNVERIFIED (Claude draft; M5/T7; run in the cloud sandbox only, not yet on the owner's machine)
/**
 * T7: lib/works-ui/playback.ts (D19 + D23) in the fake world. Videos get native-like `pause` events (the harness' FakeVideo.pause
 * does not fire one) and an `ended` flag. Programmatic pauses must not become sticky; user pauses must.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { PlaybackScene, type FakeVideo } from "./helpers/works-harness";
import { mountWorksPlayback, type PlaybackVideo } from "../lib/works-ui/playback";
import { cardIndexesOf, emitWorksClose, WORKS_CLOSE_EVENT } from "../lib/works-ui/events";

type NV = FakeVideo & { ended: boolean };

function scene(opts: { cards?: number; noVideo?: number[]; playOutcome?: "resolve" | "reject" } = {}) {
  const w = new PlaybackScene({ cards: opts.cards ?? 4, noVideo: opts.noVideo, playOutcome: opts.playOutcome });
  for (const v of w.videos) {
    if (!v) continue;
    const nv = v as NV;
    nv.ended = false;
    const origPause = v.pause.bind(v);
    v.pause = () => { origPause(); v.dispatch("pause"); }; // native: a pause event follows
  }
  const pb = mountWorksPlayback({
    win: w.win(),
    cards: w.cards.map((c, i) => ({ getBoundingClientRect: () => c.getBoundingClientRect(), video: () => w.videos[i] as unknown as PlaybackVideo | null })),
  });
  const focus = (i: number | null) => {
    w.cards.forEach((c, j) => { c.rect = { ...c.rect, top: j === i ? 96 : 3000 + j * 600, bottom: j === i ? 700 : 3600 + j * 600 }; });
    w.apply({ op: "scroll" });
    w.apply({ op: "frame" });
  };
  const userPause = (i: number) => { const v = w.videos[i] as FakeVideo; v.paused = true; v.dispatch("pause"); };
  const userPlay = (i: number) => (w.videos[i] as FakeVideo).userPlay();
  const playing = () => w.videos.map((v, i) => (v && !v.paused ? i : -1)).filter((i) => i >= 0);
  return { w, pb, focus, userPause, userPlay, playing };
}

test("first update after 100 ms: the focused card auto-plays muted", () => {
  const s = scene();
  s.w.cards[1].rect = { ...s.w.cards[1].rect, top: 96, bottom: 700 };
  s.w.apply({ op: "advance", ms: 100 });
  assert.deepEqual(s.playing(), [1]);
  assert.equal((s.w.videos[1] as FakeVideo).muted, true);
  s.pb.dispose();
});

test("D23: a focus change does NOT pause the playing video and does not start a second one", () => {
  const s = scene();
  s.focus(0);
  assert.deepEqual(s.playing(), [0]);
  s.focus(1);
  assert.deepEqual(s.playing(), [0]);
  s.pb.dispose();
});

test("D23: the focus cache — same focus again changes nothing", () => {
  const s = scene();
  s.focus(0);
  const n = s.w.log.length;
  s.focus(0);
  assert.equal(s.w.log.length, n);
  s.pb.dispose();
});

test("D19: one video globally — the user plays another one, the first is paused by code", () => {
  const s = scene();
  s.focus(0);
  s.userPlay(2);
  assert.deepEqual(s.playing(), [2]);
  s.pb.dispose();
});

test("safety net: any play event pauses every other playing video (even one the state does not know)", () => {
  const s = scene();
  const v0 = s.w.videos[0] as FakeVideo, v1 = s.w.videos[1] as FakeVideo;
  v0.paused = false; // started behind the controller's back
  s.userPlay(1);
  assert.equal(v0.paused, true);
  assert.equal(v1.paused, false);
  s.pb.dispose();
});

test("D23: programmatic pause is NOT sticky — the paused video auto-plays again when focused later with nothing playing", () => {
  const s = scene();
  s.focus(0); // 0 plays
  s.userPlay(2); // 0 paused by code, 2 plays
  s.userPause(2); // sticky for 2
  assert.deepEqual(s.playing(), []);
  s.focus(1); // 1 plays
  s.userPause(1);
  s.focus(0); // 0 was paused by code only: plays again
  assert.deepEqual(s.playing(), [0]);
  s.pb.dispose();
});

test("D23: a user pause is sticky — no auto-resume while the card stays focused, nor after it is focused again", () => {
  const s = scene();
  s.focus(0);
  s.userPause(0);
  assert.deepEqual(s.playing(), []);
  s.w.apply({ op: "scroll" }); s.w.apply({ op: "frame" });
  s.w.apply({ op: "resize" }); s.w.apply({ op: "frame" });
  assert.deepEqual(s.playing(), []);
  s.focus(1); // 1 plays, 0 untouched
  s.userPause(1);
  s.focus(0);
  assert.deepEqual(s.playing(), [], "0 is still sticky-paused");
  s.userPlay(0); // only a user play clears it
  assert.deepEqual(s.playing(), [0]);
  s.pb.dispose();
});

test("D23: ended is not a user pause", () => {
  const s = scene();
  s.focus(0);
  const v = s.w.videos[0] as NV;
  v.ended = true;
  v.paused = true;
  v.dispatch("pause");
  v.dispatch("ended");
  s.focus(null);
  s.focus(0);
  assert.deepEqual(s.playing(), [0], "0 may auto-play again: it is not sticky");
  s.pb.dispose();
});

test("D19: Close Category pauses the playing video only when it is inside that category; it is not a sticky pause", () => {
  const s = scene();
  s.focus(2); // card 2 plays; category X = cards 0,1  category Y = cards 2,3
  s.pb.closeCategory([0, 1]);
  assert.deepEqual(s.playing(), [2], "closing another category never stops it");
  s.pb.closeCategory([2, 3]);
  assert.deepEqual(s.playing(), []);
  s.focus(0);
  s.focus(2);
  assert.deepEqual(s.playing(), [0], "the closed video was not made sticky: the next focus change can play");
  s.pb.dispose();
});

test("scrolling away (no close event) never pauses the playing video", () => {
  const s = scene();
  s.focus(1);
  s.focus(null);
  assert.deepEqual(s.playing(), [1]);
  s.pb.dispose();
});

test("a rejected play() (autoplay blocked) leaves nothing playing and nothing sticky; the next focus change tries again", async () => {
  const s = scene({ playOutcome: "reject" });
  s.focus(0);
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(s.playing(), []);
  (s.w.videos[1] as FakeVideo).playOutcome = "resolve";
  s.focus(1);
  assert.deepEqual(s.playing(), [1]);
  s.focus(0);
  s.pb.dispose();
});

test("a card without a video is never focused for playback", () => {
  const s = scene({ noVideo: [0] });
  s.focus(0);
  assert.deepEqual(s.playing(), []);
  s.focus(1);
  assert.deepEqual(s.playing(), [1]);
  s.pb.dispose();
});

test("zero cards: nothing is registered (v4)", () => {
  const w = new PlaybackScene({ cards: 0 });
  const pb = mountWorksPlayback({ win: w.win(), cards: [] });
  assert.deepEqual([w.resources().scroll, w.resources().resize, w.resources().timers], [0, 0, 0]);
  pb.closeCategory([0]);
  pb.dispose();
});

test("F6 teardown: after dispose no listener, timer, frame or play listener is left and later events do nothing", () => {
  const s = scene();
  s.focus(0);
  const r = s.w.resources();
  assert.ok(r.scroll === 1 && r.resize === 1 && r.playListeners === 3 + 1);
  s.pb.dispose();
  s.pb.dispose();
  const after = s.w.resources();
  assert.deepEqual([after.scroll, after.resize, after.timers, after.frames, after.playListeners], [0, 0, 0, 0, 0]);
  const n = s.w.log.length;
  s.userPlay(3);
  s.pb.closeCategory([0]);
  s.w.apply({ op: "advance", ms: 1000 });
  assert.equal(s.w.log.filter((l) => /pause\(\)|play\(\)/.test(l)).length, s.w.log.slice(0, n).filter((l) => /pause\(\)|play\(\)/.test(l)).length);
});

test("StrictMode: mount, dispose, mount — only the live controller reacts", () => {
  const w = new PlaybackScene({ cards: 2 });
  for (const v of w.videos) if (v) { const o = v.pause.bind(v); v.pause = () => { o(); v.dispatch("pause"); }; (v as NV).ended = false; }
  const env = () => ({ win: w.win(), cards: w.cards.map((c, i) => ({ getBoundingClientRect: () => c.getBoundingClientRect(), video: () => w.videos[i] as unknown as PlaybackVideo })) });
  const a = mountWorksPlayback(env());
  a.dispose();
  const b = mountWorksPlayback(env());
  assert.equal(w.resources().scroll, 1);
  w.cards[0].rect = { ...w.cards[0].rect, top: 96, bottom: 700 };
  w.apply({ op: "advance", ms: 100 });
  assert.equal(w.log.filter((l) => /video\[0\]\.play\(\)/.test(l)).length, 1);
  b.dispose();
});

// ---------- events ----------

test("emitWorksClose dispatches the window event with the category; cardIndexesOf maps categories to card indexes", () => {
  const t = new EventTarget();
  const got: string[] = [];
  t.addEventListener(WORKS_CLOSE_EVENT, (e) => got.push((e as CustomEvent<{ category: string }>).detail.category));
  emitWorksClose(t, "social");
  assert.deepEqual(got, ["social"]);
  assert.deepEqual(cardIndexesOf(["a", "a", "b", "a"], "a"), [0, 1, 3]);
  assert.deepEqual(cardIndexesOf(["a", "b"], "zzz"), []);
});
