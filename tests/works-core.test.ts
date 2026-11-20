// STATUS: UNVERIFIED (Claude draft; M1/T3; run in the cloud sandbox only, not yet on the owner's machine)
/**
 * T3: lib/works.ts. Every rule is a named check run against an implementation object, so the same checks run on the
 * real code (must pass) and on deliberately broken copies (the named check must fail: mutation test).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  STICKY_TOP,
  cardNum,
  categoryReducer,
  coverVisible,
  focusedIndex,
  groupWorks,
  initialCategoryState,
  initialPlaybackState,
  isDone,
  playbackAction,
  shouldReset,
  type CategoryAction,
  type CategoryState,
  type PlaybackEvent,
  type PlaybackState,
} from "../lib/works";
import { focusedIndex as originalFocusedIndex, STICKY_TOP as ORIGINAL_STICKY_TOP } from "../lib/works/focus";

type Cat = { id: string; label: { ar: string } ; cta: { ar: string } };
type Item = { id: string; category: string; order: number };

interface Impl {
  groupWorks: typeof groupWorks;
  cardNum: typeof cardNum;
  categoryReducer: typeof categoryReducer;
  coverVisible: typeof coverVisible;
  shouldReset: typeof shouldReset;
  playbackAction: typeof playbackAction;
}
const REAL: Impl = { groupWorks, cardNum, categoryReducer, coverVisible, shouldReset, playbackAction };

const cat = (id: string): Cat => ({ id, label: { ar: id }, cta: { ar: id } });
const item = (id: string, category: string, order: number): Item => ({ id, category, order });
const ids = (list: readonly { id: string }[]) => list.map((x) => x.id);

function run(impl: Impl, start: CategoryState, actions: CategoryAction[]): CategoryState {
  return actions.reduce((s, a) => impl.categoryReducer(s, a), start);
}
const S = (effect: CategoryState["effect"], open: boolean, everOpened: boolean): CategoryState => ({ effect, open, everOpened });

function play(impl: Impl, start: PlaybackState, events: PlaybackEvent[]) {
  let state = start;
  const commands: Array<ReturnType<typeof playbackAction>["command"]> = [];
  for (const e of events) {
    const r = impl.playbackAction(state, e);
    state = r.state;
    commands.push(r.command);
  }
  return { state, commands };
}
const P = (playingId: string | null, focusedId: string | null, userPaused: string[] = []): PlaybackState => ({ playingId, focusedId, userPaused });

// ---------- the rules (name -> check) ----------

const CHECKS: Record<string, (impl: Impl) => void> = {
  "group: categories keep their order and items are sorted by `order`"(impl) {
    const g = impl.groupWorks([cat("a"), cat("b")], [item("b2", "b", 2), item("a2", "a", 9), item("b1", "b", 1), item("a1", "a", 3)]);
    assert.deepEqual(g.map((x) => x.category.id), ["a", "b"]);
    assert.deepEqual(g.map((x) => ids(x.items)), [["a1", "a2"], ["b1", "b2"]]);
  },
  "group: equal `order` keeps input order (stable)"(impl) {
    const g = impl.groupWorks([cat("a")], [item("x", "a", 1), item("y", "a", 1), item("z", "a", 1)]);
    assert.deepEqual(ids(g[0].items), ["x", "y", "z"]);
  },
  "group: empty categories are not returned"(impl) {
    const g = impl.groupWorks([cat("a"), cat("empty"), cat("b")], [item("a1", "a", 1), item("b1", "b", 1)]);
    assert.deepEqual(g.map((x) => x.category.id), ["a", "b"]);
  },
  "group: items with an unknown category are not returned"(impl) {
    const g = impl.groupWorks([cat("a")], [item("a1", "a", 1), item("ghost", "nope", 1)]);
    assert.deepEqual(g.map((x) => ids(x.items)), [["a1"]]);
  },
  "group: nothing in, nothing out; inputs are not mutated"(impl) {
    assert.deepEqual(impl.groupWorks([], []), []);
    assert.deepEqual(impl.groupWorks([cat("a")], []), []);
    assert.deepEqual(impl.groupWorks([], [item("a1", "a", 1)]), []);
    const works = [item("a2", "a", 2), item("a1", "a", 1)];
    const before = JSON.stringify(works);
    impl.groupWorks([cat("a")], works);
    assert.equal(JSON.stringify(works), before);
  },
  "cardNum: index + 1 with two digits, 9 -> 09, 10 -> 10"(impl) {
    assert.equal(impl.cardNum(0), "01");
    assert.equal(impl.cardNum(8), "09");
    assert.equal(impl.cardNum(9), "10");
    assert.equal(impl.cardNum(98), "99");
    assert.equal(impl.cardNum(99), "100");
  },
  "cardNum: numbering restarts at 1 in every category and ignores the id"(impl) {
    const g = impl.groupWorks([cat("a"), cat("b")], [item("w77", "a", 1), item("w3", "a", 2), item("w500", "b", 1)]);
    assert.deepEqual(g.map((x) => x.items.map((_, i) => impl.cardNum(i))), [["01", "02"], ["01"]]);
  },
  "reducer: detonate -> boom -> reveal; reveal sets open and everOpened and keeps the effect"(impl) {
    let s = initialCategoryState;
    s = impl.categoryReducer(s, { type: "detonate" });
    assert.deepEqual(s, S("counting", false, false));
    s = impl.categoryReducer(s, { type: "boom" });
    assert.deepEqual(s, S("exploding", false, false));
    s = impl.categoryReducer(s, { type: "reveal" });
    assert.deepEqual(s, S("exploding", true, true));
  },
  "reducer: detonate is ignored unless idle and never opened (v4 `done` guard)"(impl) {
    assert.deepEqual(impl.categoryReducer(S("counting", false, false), { type: "detonate" }), S("counting", false, false));
    assert.deepEqual(impl.categoryReducer(S("exploding", false, false), { type: "detonate" }), S("exploding", false, false));
    assert.deepEqual(impl.categoryReducer(S("idle", false, true), { type: "detonate" }), S("idle", false, true));
  },
  "reducer: boom only moves counting -> exploding"(impl) {
    assert.deepEqual(impl.categoryReducer(S("idle", false, false), { type: "boom" }), S("idle", false, false));
    assert.deepEqual(impl.categoryReducer(S("exploding", true, true), { type: "boom" }), S("exploding", true, true));
  },
  "reducer: openNow opens directly, without counting or exploding"(impl) {
    const s = impl.categoryReducer(S("idle", false, true), { type: "openNow" });
    assert.deepEqual(s, S("idle", true, true));
    assert.equal(run(impl, initialCategoryState, [{ type: "openNow" }]).effect, "idle");
  },
  "reducer: close sets open=false only"(impl) {
    assert.deepEqual(impl.categoryReducer(S("exploding", true, true), { type: "close" }), S("exploding", false, true));
    assert.deepEqual(impl.categoryReducer(S("idle", true, true), { type: "close" }), S("idle", false, true));
  },
  "reducer: reset touches the effect only and never `open` (D22)"(impl) {
    assert.deepEqual(impl.categoryReducer(S("exploding", true, true), { type: "reset" }), S("idle", true, true));
    assert.deepEqual(impl.categoryReducer(S("counting", true, true), { type: "reset" }), S("idle", true, true));
    assert.deepEqual(impl.categoryReducer(S("exploding", false, true), { type: "reset" }), S("idle", false, true));
  },
  "reducer: reset while open leaves the category open until Close (scroll away, come back)"(impl) {
    const s = run(impl, initialCategoryState, [{ type: "detonate" }, { type: "boom" }, { type: "reveal" }, { type: "reset" }, { type: "reset" }]);
    assert.deepEqual(s, S("idle", true, true));
  },
  "reducer: Q1 — a reset in the middle of the run restores the idle effect, the pending reveal still opens"(impl) {
    const s = run(impl, initialCategoryState, [{ type: "detonate" }, { type: "boom" }, { type: "reset" }]);
    assert.deepEqual(s, S("idle", false, false));
    assert.equal(impl.coverVisible(s), true, "cover is still there after the mid-run reset");
    assert.deepEqual(impl.categoryReducer(s, { type: "reveal" }), S("idle", true, true));
  },
  "reducer: no burst after the first open (cover never returns), also after Close"(impl) {
    const opened = run(impl, initialCategoryState, [{ type: "detonate" }, { type: "boom" }, { type: "reveal" }]);
    assert.equal(impl.coverVisible(opened), false);
    const closed = impl.categoryReducer(opened, { type: "close" });
    assert.equal(impl.coverVisible(closed), false);
    assert.equal(impl.categoryReducer(closed, { type: "detonate" }).effect, closed.effect, "no second detonation");
    const reopened = run(impl, closed, [{ type: "openNow" }]);
    assert.deepEqual(reopened, { ...closed, open: true });
    assert.equal(impl.coverVisible(reopened), false);
  },
  "cover: visible for a never-opened category in every effect state"(impl) {
    assert.equal(impl.coverVisible(S("idle", false, false)), true);
    assert.equal(impl.coverVisible(S("counting", false, false)), true);
    assert.equal(impl.coverVisible(S("exploding", false, false)), true);
    assert.equal(impl.coverVisible(S("idle", false, true)), false);
  },
  "shouldReset: only when done, out of view and left through the bottom (top > 0)"(impl) {
    assert.equal(impl.shouldReset({ done: true, isIntersecting: false, top: 1 }), true);
    assert.equal(impl.shouldReset({ done: false, isIntersecting: false, top: 1 }), false);
    assert.equal(impl.shouldReset({ done: true, isIntersecting: true, top: 1 }), false);
    assert.equal(impl.shouldReset({ done: true, isIntersecting: false, top: 0 }), false);
    assert.equal(impl.shouldReset({ done: true, isIntersecting: false, top: -300 }), false);
  },
  "playback: a focus change auto-plays (muted) when nothing plays"(impl) {
    const r = play(impl, initialPlaybackState, [{ type: "focus", id: "v1" }]);
    assert.deepEqual(r.commands, [{ type: "play", id: "v1", muted: true }]);
    assert.deepEqual(r.state, P("v1", "v1"));
  },
  "playback: the same focus again does nothing (v4 lastFocused cache)"(impl) {
    const r = play(impl, initialPlaybackState, [{ type: "focus", id: "v1" }, { type: "focus", id: "v1" }]);
    assert.deepEqual(r.commands, [{ type: "play", id: "v1", muted: true }, { type: "none" }]);
  },
  "playback: focus change never pauses another video and never starts one while another plays"(impl) {
    const r = play(impl, P("v1", "v1"), [{ type: "focus", id: "v2" }]);
    assert.deepEqual(r.commands, [{ type: "none" }]);
    assert.deepEqual(r.state, P("v1", "v2"));
  },
  "playback: focus on nothing (null) does nothing and keeps the playing video"(impl) {
    const r = play(impl, P("v1", "v1"), [{ type: "focus", id: null }]);
    assert.deepEqual(r.commands, [{ type: "none" }]);
    assert.equal(r.state.playingId, "v1");
  },
  "playback: one video globally — a user play pauses the previous one"(impl) {
    const r = play(impl, P("v1", "v1"), [{ type: "userPlay", id: "v2" }]);
    assert.deepEqual(r.commands, [{ type: "pause", id: "v1" }]);
    assert.equal(r.state.playingId, "v2");
  },
  "playback: a user play of the video that already plays pauses nobody"(impl) {
    const r = play(impl, P("v1", "v1"), [{ type: "userPlay", id: "v1" }]);
    assert.deepEqual(r.commands, [{ type: "none" }]);
  },
  "playback: a user pause is sticky — no auto-resume on the same or on a later focus"(impl) {
    const r = play(impl, P("v1", "v1"), [
      { type: "userPause", id: "v1" },
      { type: "focus", id: "v2" }, // v2 plays (nothing playing)
      { type: "userPause", id: "v2" },
      { type: "focus", id: "v1" }, // back on v1: still sticky
      { type: "focus", id: null },
      { type: "focus", id: "v1" },
    ]);
    assert.deepEqual(r.commands.map((c) => c.type), ["none", "play", "none", "none", "none", "none"]);
    assert.deepEqual([...r.state.userPaused].sort(), ["v1", "v2"]);
    assert.equal(r.state.playingId, null);
  },
  "playback: only a user play clears the sticky pause"(impl) {
    const r = play(impl, P(null, "v1", ["v1", "v2"]), [{ type: "userPlay", id: "v1" }]);
    assert.deepEqual([...r.state.userPaused], ["v2"]);
    assert.equal(r.state.playingId, "v1");
  },
  "playback: a programmatic pause (safety net) does NOT set the sticky pause"(impl) {
    const r = play(impl, P("v1", "v1"), [{ type: "programmaticPause", id: "v1" }]);
    assert.deepEqual([...r.state.userPaused], []);
    assert.equal(r.state.playingId, null);
    const again = play(impl, r.state, [{ type: "focus", id: "v2" }]);
    assert.equal(again.commands[0].type, "play", "the next focus change may auto-play");
  },
  "playback: the video that was paused by the safety net can auto-play on a later focus change"(impl) {
    const r = play(impl, initialPlaybackState, [
      { type: "focus", id: "v1" }, // v1 plays
      { type: "userPlay", id: "v2" }, // user starts v2 -> v1 paused by code
      { type: "programmaticPause", id: "v1" },
      { type: "userPause", id: "v2" },
      { type: "focus", id: "v3" },
      { type: "focus", id: "v1" },
    ]);
    assert.deepEqual(r.commands.map((c) => c.type), ["play", "pause", "none", "none", "play", "none"]);
    assert.ok(!r.state.userPaused.includes("v1"));
  },
  "playback: a rejected play() leaves nothing playing and nothing sticky"(impl) {
    const r = play(impl, initialPlaybackState, [{ type: "focus", id: "v1" }, { type: "playFailed", id: "v1" }]);
    assert.equal(r.state.playingId, null);
    assert.deepEqual([...r.state.userPaused], []);
  },
  "playback: ended frees the slot and is not a sticky pause"(impl) {
    const r = play(impl, P("v1", "v1"), [{ type: "ended", id: "v1" }]);
    assert.equal(r.state.playingId, null);
    assert.deepEqual([...r.state.userPaused], []);
  },
  "playback: Close Category stops the playing video only when it is inside that category"(impl) {
    const inside = play(impl, P("v1", "v1"), [{ type: "closeCategory", videoIds: ["v1", "v2"] }]);
    assert.deepEqual(inside.commands, [{ type: "pause", id: "v1" }]);
    assert.equal(inside.state.playingId, null);
    assert.deepEqual([...inside.state.userPaused], [], "closing is not a user pause");
  },
  "playback: closing a different category never stops the playing video (D19)"(impl) {
    const other = play(impl, P("v1", "v1"), [{ type: "closeCategory", videoIds: ["v7", "v8"] }]);
    assert.deepEqual(other.commands, [{ type: "none" }]);
    assert.equal(other.state.playingId, "v1");
    const nothing = play(impl, P(null, null), [{ type: "closeCategory", videoIds: ["v1"] }]);
    assert.deepEqual(nothing.commands, [{ type: "none" }]);
  },
  "playback: scrolling away (reset) is not a close — the reducer never sees it"(impl) {
    // reset is a category action; it must not be able to change the playback state by construction
    const s = P("v1", "v1");
    assert.deepEqual(play(impl, s, [{ type: "focus", id: null }]).state.playingId, "v1");
  },
  "playback: states are not mutated"(impl) {
    const s = P("v1", "v1", ["v9"]);
    const frozen = JSON.stringify(s);
    impl.playbackAction(s, { type: "userPause", id: "v1" });
    impl.playbackAction(s, { type: "userPlay", id: "v9" });
    assert.equal(JSON.stringify(s), frozen);
  },
};

for (const [name, check] of Object.entries(CHECKS)) {
  test(name, () => check(REAL));
}

// ---------- plain tests ----------

test("isDone is the v4 `done` flag: any non-idle effect", () => {
  assert.equal(isDone(S("idle", true, true)), false);
  assert.equal(isDone(S("counting", false, false)), true);
  assert.equal(isDone(S("exploding", true, true)), true);
});

test("focusedIndex and STICKY_TOP are re-exported unchanged from lib/works/focus", () => {
  assert.equal(focusedIndex, originalFocusedIndex);
  assert.equal(STICKY_TOP, ORIGINAL_STICKY_TOP);
  assert.equal(STICKY_TOP, 96);
});

// ---------- mutation test: a broken copy of one rule must be caught by the check that guards it ----------

interface Mutant {
  name: string;
  impl: Impl;
  caughtBy: string[]; // at least one of these checks must fail on the mutant
}
const mutate = (patch: Partial<Impl>): Impl => ({ ...REAL, ...patch });

const MUTANTS: Mutant[] = [
  {
    name: "reset also closes the category (violates D22)",
    impl: mutate({ categoryReducer: (s, a) => (a.type === "reset" ? { ...categoryReducer(s, a), open: false } : categoryReducer(s, a)) }),
    caughtBy: ["reducer: reset touches the effect only and never `open` (D22)", "reducer: reset while open leaves the category open until Close (scroll away, come back)"],
  },
  {
    name: "openNow runs the countdown",
    impl: mutate({ categoryReducer: (s, a) => (a.type === "openNow" ? { ...categoryReducer(s, a), effect: "counting" } : categoryReducer(s, a)) }),
    caughtBy: ["reducer: openNow opens directly, without counting or exploding"],
  },
  {
    name: "close also clears everOpened (the burst would replay)",
    impl: mutate({ categoryReducer: (s, a) => (a.type === "close" ? { ...categoryReducer(s, a), everOpened: false } : categoryReducer(s, a)) }),
    caughtBy: ["reducer: no burst after the first open (cover never returns), also after Close", "reducer: close sets open=false only"],
  },
  {
    name: "detonate is not guarded (double click restarts the count)",
    impl: mutate({ categoryReducer: (s, a) => (a.type === "detonate" ? { ...s, effect: "counting" } : categoryReducer(s, a)) }),
    caughtBy: ["reducer: detonate is ignored unless idle and never opened (v4 `done` guard)"],
  },
  {
    name: "shouldReset ignores the direction (top > 0)",
    impl: mutate({ shouldReset: ({ done, isIntersecting }) => done && !isIntersecting }),
    caughtBy: ["shouldReset: only when done, out of view and left through the bottom (top > 0)"],
  },
  {
    name: "cover disappears when the effect starts",
    impl: mutate({ coverVisible: (s) => s.effect === "idle" && !s.everOpened }),
    caughtBy: ["cover: visible for a never-opened category in every effect state"],
  },
  {
    name: "programmatic pause sets the sticky pause (violates D23)",
    impl: mutate({
      playbackAction: (s, e) =>
        e.type === "programmaticPause" ? { state: { ...s, playingId: null, userPaused: [...s.userPaused, e.id] }, command: { type: "none" } } : playbackAction(s, e),
    }),
    caughtBy: ["playback: a programmatic pause (safety net) does NOT set the sticky pause"],
  },
  {
    name: "a user pause is not sticky",
    impl: mutate({ playbackAction: (s, e) => (e.type === "userPause" ? { state: { ...s, playingId: null }, command: { type: "none" } } : playbackAction(s, e)) }),
    caughtBy: ["playback: a user pause is sticky — no auto-resume on the same or on a later focus"],
  },
  {
    name: "a user play does not clear the sticky pause",
    impl: mutate({ playbackAction: (s, e) => (e.type === "userPlay" ? { ...playbackAction(s, e), state: { ...playbackAction(s, e).state, userPaused: s.userPaused } } : playbackAction(s, e)) }),
    caughtBy: ["playback: only a user play clears the sticky pause"],
  },
  {
    name: "a focus change pauses the playing video (violates D19)",
    impl: mutate({
      playbackAction: (s, e) => {
        const r = playbackAction(s, e);
        return e.type === "focus" && e.id !== s.focusedId && s.playingId && s.playingId !== e.id ? { state: { ...r.state, playingId: null }, command: { type: "pause", id: s.playingId } } : r;
      },
    }),
    caughtBy: ["playback: focus change never pauses another video and never starts one while another plays"],
  },
  {
    name: "auto-play ignores that another video plays",
    impl: mutate({
      playbackAction: (s, e) => (e.type === "focus" && e.id && e.id !== s.focusedId ? { state: { ...s, focusedId: e.id, playingId: e.id }, command: { type: "play", id: e.id, muted: true } } : playbackAction(s, e)),
    }),
    caughtBy: ["playback: focus change never pauses another video and never starts one while another plays"],
  },
  {
    name: "a new play does not stop the previous video",
    impl: mutate({ playbackAction: (s, e) => (e.type === "userPlay" ? { ...playbackAction(s, e), command: { type: "none" } } : playbackAction(s, e)) }),
    caughtBy: ["playback: one video globally — a user play pauses the previous one"],
  },
  {
    name: "Close Category stops any playing video, even from another category",
    impl: mutate({
      playbackAction: (s, e) => (e.type === "closeCategory" && s.playingId ? { state: { ...s, playingId: null }, command: { type: "pause", id: s.playingId } } : playbackAction(s, e)),
    }),
    caughtBy: ["playback: closing a different category never stops the playing video (D19)"],
  },
  {
    name: "Close Category never stops the video inside it",
    impl: mutate({ playbackAction: (s, e) => (e.type === "closeCategory" ? { state: s, command: { type: "none" } } : playbackAction(s, e)) }),
    caughtBy: ["playback: Close Category stops the playing video only when it is inside that category"],
  },
  {
    name: "numbering starts at 0",
    impl: mutate({ cardNum: (i) => String(i).padStart(2, "0") }),
    caughtBy: ["cardNum: index + 1 with two digits, 9 -> 09, 10 -> 10"],
  },
  {
    name: "empty categories are returned",
    impl: mutate({ groupWorks: ((cats: readonly Cat[], works: readonly Item[]) => cats.map((c) => ({ category: c, items: works.filter((w) => w.category === c.id) }))) as unknown as typeof groupWorks }),
    caughtBy: ["group: empty categories are not returned"],
  },
  {
    name: "items are not sorted by order",
    impl: mutate({
      groupWorks: ((cats: readonly Cat[], works: readonly Item[]) =>
        cats.map((c) => ({ category: c, items: works.filter((w) => w.category === c.id) })).filter((g) => g.items.length > 0)) as unknown as typeof groupWorks,
    }),
    caughtBy: ["group: categories keep their order and items are sorted by `order`"],
  },
];

function failing(impl: Impl): string[] {
  const out: string[] = [];
  for (const [name, check] of Object.entries(CHECKS)) {
    try {
      check(impl);
    } catch {
      out.push(name);
    }
  }
  return out;
}

test("mutation: the real implementation violates no rule", () => {
  assert.deepEqual(failing(REAL), []);
});

for (const m of MUTANTS) {
  test(`mutation: ${m.name} is caught`, () => {
    const caught = failing(m.impl);
    assert.ok(caught.length > 0, "no check failed on the mutant");
    assert.ok(
      m.caughtBy.some((c) => caught.includes(c)),
      `expected one of [${m.caughtBy.join(" | ")}] to fail, got [${caught.join(" | ")}]`,
    );
    for (const name of m.caughtBy) assert.ok(name in CHECKS, `unknown check name: ${name}`);
  });
}

test("mutation: every check is guarded by at least one mutant", () => {
  const guarded = new Set(MUTANTS.flatMap((m) => m.caughtBy));
  const unguarded = Object.keys(CHECKS).filter((n) => !guarded.has(n));
  // checks that exist for completeness and have no dedicated mutant are listed here on purpose
  const ALLOWED = new Set([
    "group: nothing in, nothing out; inputs are not mutated",
    "group: equal `order` keeps input order (stable)",
    "group: items with an unknown category are not returned",
    "cardNum: numbering restarts at 1 in every category and ignores the id",
    "reducer: detonate -> boom -> reveal; reveal sets open and everOpened and keeps the effect",
    "reducer: boom only moves counting -> exploding",
    "reducer: Q1 — a reset in the middle of the run restores the idle effect, the pending reveal still opens",
    "playback: a focus change auto-plays (muted) when nothing plays",
    "playback: the same focus again does nothing (v4 lastFocused cache)",
    "playback: focus on nothing (null) does nothing and keeps the playing video",
    "playback: a user play of the video that already plays pauses nobody",
    "playback: the video that was paused by the safety net can auto-play on a later focus change",
    "playback: a rejected play() leaves nothing playing and nothing sticky",
    "playback: ended frees the slot and is not a sticky pause",
    "playback: scrolling away (reset) is not a close — the reducer never sees it",
    "playback: states are not mutated",
  ]);
  assert.deepEqual(unguarded.filter((n) => !ALLOWED.has(n)), []);
});
