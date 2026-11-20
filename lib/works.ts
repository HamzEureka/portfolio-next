// STATUS: UNVERIFIED (Claude draft; M1/T3; checked in the cloud sandbox only, not yet on the owner's machine)
/**
 * T3: pure logic of the works section (v7). No DOM, no React, no dependency.
 * Decisions: D19 (playback, one video globally), D20 (grouping, numbering), D22 (open vs effect), D23 (sticky pause).
 * Original v4 rules are kept in lib/works/* (focus, playback, detonation, category-reveal); this file only adds
 * the state/decision layer that the v7 controller and UI call.
 */
import type { Category, Work } from "./content/types";

export { STICKY_TOP, focusedIndex } from "./works/focus";

// ---------- D20: grouping and numbering ----------

export interface WorkGroup<C extends Pick<Category, "id">, W extends Pick<Work, "category" | "order">> {
  category: C;
  items: W[];
}

/**
 * One group per category, in the order of `categories`; items sorted by `order` (stable for equal `order`).
 * Categories without items are not returned; items whose `category` matches no category are not returned.
 * Inputs are not mutated.
 */
export function groupWorks<C extends Pick<Category, "id">, W extends Pick<Work, "category" | "order">>(
  categories: readonly C[],
  works: readonly W[],
): WorkGroup<C, W>[] {
  const out: WorkGroup<C, W>[] = [];
  for (const category of categories) {
    const items = works.filter((w) => w.category === category.id).sort((a, b) => a.order - b.order);
    if (items.length > 0) out.push({ category, items });
  }
  return out;
}

/** Card number inside one category: index + 1, zero-padded to two digits ("01", "09", "10", "100"). Independent of `id`. */
export function cardNum(index: number): string {
  return String(index + 1).padStart(2, "0");
}

// ---------- D22: open state and effect state, kept apart ----------

/** `effect` is the v4 `done` flag over time: idle (not done) | counting (3-2-1) | exploding (boom, and v4 `done` after it). */
export type Effect = "idle" | "counting" | "exploding";

export interface CategoryState {
  effect: Effect;
  /** The list is visible. Changed only by reveal, openNow and close. */
  open: boolean;
  /** `open` has been true at least once. The cover (with the burst) is shown only while this is false. */
  everOpened: boolean;
}

export const initialCategoryState: CategoryState = { effect: "idle", open: false, everOpened: false };

export type CategoryAction =
  | { type: "detonate" } // click on the cover: idle -> counting (ignored when not idle or already opened once)
  | { type: "boom" } // counting -> exploding
  | { type: "reveal" } // the 2200 ms timer: list opens. `effect` is NOT touched (v4 `done` stays), Q1: also after a reset
  | { type: "openNow" } // Open Category: list opens, no countdown, no burst, `effect` untouched
  | { type: "close" } // Close Category: `open = false` only
  | { type: "reset" }; // scroll-away: `effect = idle` only, never `open`/`everOpened`

export function categoryReducer(state: CategoryState, action: CategoryAction): CategoryState {
  switch (action.type) {
    case "detonate":
      return state.effect === "idle" && !state.everOpened ? { ...state, effect: "counting" } : state;
    case "boom":
      return state.effect === "counting" ? { ...state, effect: "exploding" } : state;
    case "reveal":
    case "openNow":
      return state.open && state.everOpened ? state : { ...state, open: true, everOpened: true };
    case "close":
      return state.open ? { ...state, open: false } : state;
    case "reset":
      return state.effect === "idle" ? state : { ...state, effect: "idle" };
    default:
      return state;
  }
}

/** The cover (bomb, countdown, canvas) is mounted only for a category that has never been opened. */
export const coverVisible = (state: CategoryState): boolean => !state.everOpened;

/** v4 `done` flag for the reset rule: any non-idle effect. */
export const isDone = (state: CategoryState): boolean => state.effect !== "idle";

/** v4 rule unchanged (index.html:2623-2625): reset only when done, out of view, and left through the bottom (`top > 0`). */
export function shouldReset(input: { done: boolean; isIntersecting: boolean; top: number }): boolean {
  return input.done && !input.isIntersecting && input.top > 0;
}

// ---------- D19 + D23: playback decisions ----------

export interface PlaybackState {
  /** Id of the video that is playing now (one globally), or null. */
  playingId: string | null;
  /** Id of the focused card at the last focus event (v4 `lastFocused` cache), or null. */
  focusedId: string | null;
  /** Videos the user paused by hand; cleared per video only by a user play. */
  userPaused: readonly string[];
}

export const initialPlaybackState: PlaybackState = { playingId: null, focusedId: null, userPaused: [] };

export type PlaybackEvent =
  /** Scroll/resize result: id of the focused card's video (null: none). Same id as last time = nothing happens. */
  | { type: "focus"; id: string | null }
  /** The user started a video (native play not caused by this code). Clears its sticky pause. */
  | { type: "userPlay"; id: string }
  /** The user paused a video. Sets its sticky pause. The controller must not send this for programmatic pauses or for `ended`. */
  | { type: "userPause"; id: string }
  /** Pause caused by code (v4 safety net, close): never sets the sticky pause. */
  | { type: "programmaticPause"; id: string }
  /** `play()` was rejected (autoplay blocked): nothing is playing, nothing is sticky. */
  | { type: "playFailed"; id: string }
  /** Playback reached the end: nothing is playing, no sticky pause. */
  | { type: "ended"; id: string }
  /** Close Category pressed; `videoIds` = the videos inside that category. */
  | { type: "closeCategory"; videoIds: readonly string[] };

export type PlaybackCommand =
  | { type: "play"; id: string; muted: true }
  | { type: "pause"; id: string }
  | { type: "none" };

const NONE: PlaybackCommand = { type: "none" };
const without = (list: readonly string[], id: string): readonly string[] => (list.includes(id) ? list.filter((x) => x !== id) : list);
const withId = (list: readonly string[], id: string): readonly string[] => (list.includes(id) ? list : [...list, id]);

/**
 * Pure decision: (state, event) -> new state + the one command the caller must run on the DOM.
 * Rules: D19 (one playing video globally; closing a category stops only a video inside it; scrolling away is not a close),
 * D23 (auto-play only on a focus change and only when nothing plays; a manual pause is sticky until a user play;
 * programmatic pauses never set it; a focus change never pauses another video).
 */
export function playbackAction(state: PlaybackState, event: PlaybackEvent): { state: PlaybackState; command: PlaybackCommand } {
  switch (event.type) {
    case "focus": {
      if (event.id === state.focusedId) return { state, command: NONE };
      const next: PlaybackState = { ...state, focusedId: event.id };
      if (event.id === null || state.playingId !== null || state.userPaused.includes(event.id)) return { state: next, command: NONE };
      return { state: { ...next, playingId: event.id }, command: { type: "play", id: event.id, muted: true } };
    }
    case "userPlay": {
      const next: PlaybackState = { ...state, playingId: event.id, userPaused: without(state.userPaused, event.id) };
      const prev = state.playingId;
      return { state: next, command: prev !== null && prev !== event.id ? { type: "pause", id: prev } : NONE };
    }
    case "userPause":
      return {
        state: { ...state, playingId: state.playingId === event.id ? null : state.playingId, userPaused: withId(state.userPaused, event.id) },
        command: NONE,
      };
    case "programmaticPause":
    case "playFailed":
    case "ended":
      return {
        state: { ...state, playingId: state.playingId === event.id ? null : state.playingId },
        command: NONE,
      };
    case "closeCategory": {
      const id = state.playingId;
      if (id === null || !event.videoIds.includes(id)) return { state, command: NONE };
      return { state: { ...state, playingId: null }, command: { type: "pause", id } };
    }
    default:
      return { state, command: NONE };
  }
}
