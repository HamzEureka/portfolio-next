// STATUS: UNVERIFIED (Claude draft; M5/T7; checked against the fake world in the cloud sandbox only, never in a browser)
/**
 * T7: page-wide playback controller of the works videos (v7). Replaces `mountPlayback` (lib/works/playback.ts, v4 port) in the
 * page, because that one pauses the other videos on a focus change and has no sticky pause (violates D19/D23). Decisions are
 * made by the pure `playbackAction` (lib/works.ts); this file only does the DOM side.
 *
 * Kept from v4 (index.html:2301-2356): all `.stack-card` in DOM order, `focusedIndex` (STICKY_TOP 96), rAF-throttled passive
 * scroll + resize, a first update after 100 ms, the "focus unchanged = nothing happens" cache, muted auto-play with a swallowed
 * `play()` rejection, the safety net (any `play` event pauses every OTHER playing video), nothing registered with zero cards.
 *
 * Changed on purpose (D19/D23):
 * - A focus change auto-plays only when no video is playing and the card is not sticky-paused; it never pauses another video.
 * - A manual pause is sticky until the user plays that video again. Code-made pauses (safety net, Close Category) carry a
 *   programmatic marker so their native "pause" event is not taken for a user pause. UNVERIFIED in a browser (event timing).
 * - Close Category pauses the playing video only if it is inside that category (`closeCategory`).
 * - Scope = the stack-card videos only (v4 used every <video> of the page).
 * - `dispose()` removes every listener/timer/frame (React unmount). Idempotent.
 */
import type { FrameApi, RectLike, ScrollWin } from "../works/contract";
import { focusedIndex } from "../works/focus";
import { initialPlaybackState, playbackAction, type PlaybackCommand, type PlaybackEvent } from "../works";

export interface PlaybackVideo {
  muted: boolean;
  readonly paused: boolean;
  readonly ended: boolean;
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: "play" | "pause" | "ended", fn: () => void): void;
  removeEventListener(type: "play" | "pause" | "ended", fn: () => void): void;
}
export interface PlaybackCard {
  getBoundingClientRect(): RectLike;
  video(): PlaybackVideo | null;
}
export interface WorksPlaybackEnv {
  win: ScrollWin & FrameApi;
  cards: readonly PlaybackCard[];
}
export interface WorksPlayback {
  /** Close Category pressed: `cardIndexes` = the cards of that category. */
  closeCategory(cardIndexes: readonly number[]): void;
  dispose(): void;
}

export function mountWorksPlayback(env: WorksPlaybackEnv): WorksPlayback {
  const { win, cards } = env;
  if (cards.length === 0) return { closeCategory() {}, dispose() {} }; // v4: returns before registering anything

  let state = initialPlaybackState;
  let mounted = true;
  let ticking = false;
  let frame: number | null = null;
  let timer: number | null = null;
  const programmatic = new WeakSet<object>();
  const idOf = (i: number): string => String(i);
  const videoOf = (id: string): PlaybackVideo | null => cards[Number(id)]?.video() ?? null;

  const pauseByCode = (video: PlaybackVideo): void => {
    if (video.paused) return;
    programmatic.add(video);
    video.pause();
  };
  const exec = (command: PlaybackCommand): void => {
    if (command.type === "play") {
      const video = videoOf(command.id);
      if (!video) return run({ type: "playFailed", id: command.id });
      video.muted = true;
      video.play().catch(() => {
        if (mounted) run({ type: "playFailed", id: command.id });
      });
    } else if (command.type === "pause") {
      const video = videoOf(command.id);
      if (video) pauseByCode(video);
    }
  };
  function run(event: PlaybackEvent): void {
    if (!mounted) return;
    const r = playbackAction(state, event);
    state = r.state;
    exec(r.command);
  }

  // SOURCE: index.html:2320-2336 (decision moved to playbackAction)
  const update = (): void => {
    if (!mounted) return;
    ticking = false;
    const f = focusedIndex(cards.length, (i) => cards[i].getBoundingClientRect());
    run({ type: "focus", id: f >= 0 && cards[f].video() ? idOf(f) : null });
  };
  const onScroll = (): void => {
    if (!ticking) {
      frame = win.requestAnimationFrame(update);
      ticking = true;
    }
  };
  win.addEventListener("scroll", onScroll, { passive: true });
  win.addEventListener("resize", onScroll);
  timer = win.setTimeout(update, 100);

  // Native events of every video present at mount (v4 `allVideos` was resolved once, too).
  const listeners: Array<{ video: PlaybackVideo; type: "play" | "pause" | "ended"; fn: () => void }> = [];
  const listen = (video: PlaybackVideo, type: "play" | "pause" | "ended", fn: () => void): void => {
    video.addEventListener(type, fn);
    listeners.push({ video, type, fn });
  };
  cards.forEach((card, i) => {
    const video = card.video();
    if (!video) return;
    const id = idOf(i);
    listen(video, "play", () => {
      programmatic.delete(video);
      run({ type: "userPlay", id });
      // SOURCE: index.html:2349-2355 safety net: every OTHER playing video is paused (by code, so not sticky)
      cards.forEach((other, j) => {
        const v = other.video();
        if (j === i || !v || v.paused) return;
        pauseByCode(v);
        run({ type: "programmaticPause", id: idOf(j) });
      });
    });
    listen(video, "pause", () => {
      if (programmatic.delete(video)) run({ type: "programmaticPause", id });
      else if (video.ended) run({ type: "ended", id });
      else run({ type: "userPause", id });
    });
    listen(video, "ended", () => run({ type: "ended", id }));
  });

  const closeCategory = (cardIndexes: readonly number[]): void => run({ type: "closeCategory", videoIds: cardIndexes.map(idOf) });

  const dispose = (): void => {
    if (!mounted) return;
    mounted = false;
    win.removeEventListener("scroll", onScroll);
    win.removeEventListener("resize", onScroll);
    if (timer !== null) win.clearTimeout(timer);
    if (frame !== null) win.cancelAnimationFrame(frame);
    timer = frame = null;
    for (const l of listeners) l.video.removeEventListener(l.type, l.fn);
    listeners.length = 0;
  };

  return { closeCategory, dispose };
}
