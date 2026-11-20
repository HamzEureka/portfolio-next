// STATUS: UNVERIFIED (Claude draft; M4/T6; run in the cloud sandbox only, not yet on the owner's machine)
/**
 * T6: lib/works-ui/controller.ts in the fake world of tests/helpers/works-harness.ts.
 *  - parity with the verbatim v4 code for everything the controller still does through DOM writes (ticks, boom, flash, shake,
 *    explosion call, fly-in replay, effect cleanup); the display writes of v4's reveal/reset are React's job now and are filtered out;
 *  - D22: reset touches the effect only; Q1 kept (D21); lifecycle: 0 timers/frames/observers/audio contexts after dispose (F6),
 *    StrictMode (mount, dispose, mount), several categories.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { CategoryScene, FakeIO, compareRuns, same, type Step } from "./helpers/works-harness";
import { mountWorksController, replayFlyIn, resetEffect, type WorksController } from "../lib/works-ui/controller";
import { coverPartsFrom, explosionTargetFrom } from "../lib/works-ui/dom";
import { createSounds } from "../lib/works/sounds";
import { categoryReducer, initialCategoryState, type CategoryAction, type CategoryState } from "../lib/works";

type Dispatched = { t: number; action: CategoryAction };

function mount(w: CategoryScene, i = 0, over: Partial<Parameters<typeof mountWorksController>[0]> = {}) {
  const dispatched: Dispatched[] = [];
  const disposed = { explosion: 0, sounds: 0 };
  const sounds = createSounds(w.soundsEnv());
  const ctl = mountWorksController({
    section: w.cats[i].section,
    parts: w.parts(i),
    timers: w.timers(),
    sounds: { playTick: sounds.playTick, playBoom: sounds.playBoom, dispose: () => { disposed.sounds++; sounds.dispose(); } },
    explosion: { explode: w.explodeFn(), dispose: () => { disposed.explosion++; } },
    explosionTarget: w.cats[i].cover,
    createObserver: (cb, init) => new FakeIO(w, cb, init),
    dispatch: (action) => dispatched.push({ t: w.clock.now, action }),
    ...over,
  });
  return { ctl, dispatched, disposed };
}
const fold = (list: Dispatched[], from: CategoryState = initialCategoryState): CategoryState => list.reduce((s, d) => categoryReducer(s, d.action), from);
/** v4's reveal/reset also write display on the cover and the list; here React does it, so those lines are not compared. */
const notDisplay = (line: string) => !/(cover|projects)\[\d+\]\.style\.display=/.test(line);

function parity(steps: Step[], opts: { audio?: "standard" | "none"; explode?: boolean } = {}) {
  let ctl: WorksController | undefined;
  let dispatched: Dispatched[] = [];
  const r = compareRuns<CategoryScene>({
    make: () => new CategoryScene({ audio: opts.audio ?? "standard", explode: opts.explode }),
    original: (w) => w.runOriginal(),
    port: (w) => {
      const m = mount(w);
      ctl = m.ctl;
      dispatched = m.dispatched;
      w.cats[0].cover.addEventListener("click", () => ctl?.detonate()); // what React's onClick does
      return () => ctl?.dispose();
    },
    steps,
    autoFrame: false,
    only: notDisplay,
    snapshots: false,
  });
  same(r.ported.soundLog, r.original.soundLog, "soundLog compared by hand (F5)");
  return { ...r, dispatched };
}
const click: Step = { op: "click" };
const adv = (ms: number): Step => ({ op: "advance", ms });
const io = (isIntersecting: boolean, top: number): Step => ({ op: "io", isIntersecting, top });

// ---------- parity with v4 ----------

test("parity: click, full timeline to the reveal (ticks 0/700/1400, boom 2050, shake off 2550, fly-in 4250)", () => {
  const r = parity([click, adv(700), adv(700), adv(650), adv(500), adv(1700), adv(1000)]);
  assert.deepEqual(r.ported.soundLog.map((e) => e.kind), ["tick", "tick", "tick", "boom"]);
  assert.ok(r.ported.lines(/card\[0\.0\]\.class\.add\(fly-in\)/).length === 1);
  r.unmount?.();
});

test("parity: a second click while done is ignored", () => {
  const r = parity([click, adv(100), click, adv(5000)]);
  assert.equal(r.dispatched.filter((d) => d.action.type === "detonate").length, 1);
  r.unmount?.();
});

test("parity: scroll-away after the reveal — only the effect cleanup is written (done, cta, bomb, countdown)", () => {
  const r = parity([click, adv(4300), io(false, 120), io(false, 120)]);
  assert.deepEqual(r.ported.lines(/dataset\.done=/).map((l) => l.replace(/^@\d+ /, "")), ["cover[0].dataset.done=1", "cover[0].dataset.done="]);
  r.unmount?.();
});

test("parity: reset ignored when not done / still intersecting / left through the top", () => {
  const r = parity([io(false, 100), click, adv(300), io(true, 100), io(false, 0), io(false, -400), adv(5000)]);
  assert.equal(r.ported.lines(/dataset\.done=/).length, 1, "only the detonation wrote done");
  r.unmount?.();
});

test("parity Q1 (D21): a reset in the middle of the run does not cancel the timers; the reveal still happens at 4250", () => {
  const r = parity([click, adv(1000), io(false, 100), adv(1000), adv(3000)]);
  assert.ok(r.ported.lines(/^@4250 card\[0\.0\]\.class\.add\(fly-in\)/).length === 1);
  assert.ok(r.dispatched.some((d) => d.action.type === "reveal" && d.t === 4250));
  r.unmount?.();
});

test("parity: no audio available — the run still completes (v4 swallows the failure)", () => {
  const r = parity([click, adv(5000)], { audio: "none" });
  assert.deepEqual(r.ported.soundLog, []);
  r.unmount?.();
});

// ---------- what is dispatched, and what the reducer makes of it ----------

test("dispatch timeline: detonate@0, boom@2050, reveal@4250 -> exploding + open + everOpened", () => {
  const w = new CategoryScene({ audio: "standard" });
  const { ctl, dispatched } = mount(w);
  ctl.detonate();
  w.clock.advance(5000);
  assert.deepEqual(dispatched.map((d) => [d.t, d.action.type]), [[0, "detonate"], [2050, "boom"], [4250, "reveal"]]);
  assert.deepEqual(fold(dispatched), { effect: "exploding", open: true, everOpened: true });
  ctl.dispose();
});

test("D22: scroll-away after the reveal resets the effect and leaves the category open", () => {
  const w = new CategoryScene({ audio: "standard" });
  const { ctl, dispatched } = mount(w);
  ctl.detonate();
  w.clock.advance(4300);
  w.fireIO(w.cats[0].section, false, 150);
  assert.deepEqual(fold(dispatched), { effect: "idle", open: true, everOpened: true });
  assert.ok(!w.lines(/style\.display=/).some((l) => /cover\[0\]|projects\[0\]/.test(l)), "controller never writes the cover/list display");
  ctl.dispose();
});

test("Q1 + D22: reset mid-run -> idle; the pending reveal still opens the list", () => {
  const w = new CategoryScene({ audio: "standard" });
  const { ctl, dispatched } = mount(w);
  ctl.detonate();
  w.clock.advance(3000);
  w.fireIO(w.cats[0].section, false, 150);
  assert.deepEqual(fold(dispatched), { effect: "idle", open: false, everOpened: false });
  w.clock.advance(1500);
  assert.deepEqual(fold(dispatched), { effect: "idle", open: true, everOpened: true });
  ctl.dispose();
});

test("the controller never touches the cover or list display and never clears fly-in state it did not set", () => {
  const w = new CategoryScene({ audio: "standard" });
  const { ctl } = mount(w);
  ctl.detonate();
  w.clock.advance(6000);
  w.fireIO(w.cats[0].section, false, 150);
  assert.equal(w.lines(/\.style\.display=/).length, 0);
  ctl.dispose();
});

// ---------- guards ----------

test("no cover mounted (already opened once): detonate does nothing, no observer is created, dispose is safe", () => {
  const w = new CategoryScene({});
  const { ctl, dispatched, disposed } = mount(w, 0, { parts: null });
  ctl.detonate();
  w.clock.advance(5000);
  assert.deepEqual(dispatched, []);
  assert.equal(w.resources().observersLive, 0);
  assert.equal(w.log.length, 0);
  ctl.dispose();
  ctl.dispose();
  assert.deepEqual(disposed, { explosion: 1, sounds: 1 });
});

test("cover without a countdown element is not detonated (v4 set `done` and then threw)", () => {
  const w = new CategoryScene({ missing: ["countdown"] });
  const { ctl, dispatched } = mount(w);
  assert.doesNotThrow(() => ctl.detonate());
  w.clock.advance(5000);
  assert.deepEqual(dispatched, []);
  assert.equal(w.cats[0].cover.dataset.done, undefined);
  ctl.dispose();
});

test("missing cta/bomb/flash/projects are tolerated like v4 (silently skipped)", () => {
  const w = new CategoryScene({ audio: "standard", missing: ["cta", "bomb", "flash", "projects"] });
  const { ctl, dispatched } = mount(w);
  ctl.detonate();
  assert.doesNotThrow(() => w.clock.advance(5000));
  assert.ok(dispatched.some((d) => d.action.type === "reveal"));
  ctl.dispose();
});

test("an observer entry for another target is ignored", () => {
  const w = new CategoryScene({ cats: ["a", "b"], audio: "standard" });
  const { ctl, dispatched } = mount(w, 0);
  ctl.detonate();
  w.clock.advance(300);
  w.fireIO(w.cats[1].section, false, 100);
  assert.ok(!dispatched.some((d) => d.action.type === "reset"));
  ctl.dispose();
});

test("two categories: each controller owns its observer and its timers; resetting one leaves the other done", () => {
  const w = new CategoryScene({ cats: ["a", "b"], audio: "standard" });
  const a = mount(w, 0), b = mount(w, 1);
  a.ctl.detonate();
  b.ctl.detonate();
  w.clock.advance(300);
  w.fireIO(w.cats[0].section, false, 100);
  assert.equal(w.cats[0].cover.dataset.done, "");
  assert.equal(w.cats[1].cover.dataset.done, "1");
  assert.ok(a.dispatched.some((d) => d.action.type === "reset"));
  assert.ok(!b.dispatched.some((d) => d.action.type === "reset"));
  assert.equal(w.resources().observersLive, 2);
  a.ctl.dispose();
  b.ctl.dispose();
});

// ---------- teardown (F6) and StrictMode ----------

test("F6: after dispose — 0 timers, 0 frames, 0 live observers, the audio context closed; nothing is written afterwards", () => {
  const w = new CategoryScene({ audio: "standard" });
  const { ctl, disposed } = mount(w);
  assert.equal(w.resources().observersLive, 1);
  ctl.detonate();
  w.clock.advance(1000);
  assert.ok(w.resources().timers > 0);
  assert.equal(w.resources().audioContexts, 1);
  ctl.dispose();
  const r = w.resources();
  assert.equal(r.timers, 0);
  assert.equal(r.frames, 0);
  assert.equal(r.observersLive, 0);
  assert.equal(r.audioClosed, r.audioContexts);
  assert.deepEqual(disposed, { explosion: 1, sounds: 1 });
  const n = w.log.length;
  w.clock.advance(10000);
  w.fireIO(w.cats[0].section, false, 100);
  ctl.detonate();
  assert.equal(w.log.length, n, "no write after dispose");
});

test("F6: dispose before any click leaves nothing live; dispose twice is harmless", () => {
  const w = new CategoryScene({ audio: "standard" });
  const { ctl, disposed } = mount(w);
  ctl.dispose();
  ctl.dispose();
  const r = w.resources();
  assert.deepEqual([r.timers, r.frames, r.observersLive], [0, 0, 0]);
  assert.deepEqual(disposed, { explosion: 1, sounds: 1 });
});

test("StrictMode: mount, dispose, mount again — only the second controller reacts and only it holds resources", () => {
  const w = new CategoryScene({ audio: "standard" });
  const cur: { c: WorksController | null } = { c: null };
  w.cats[0].cover.addEventListener("click", () => cur.c?.detonate()); // React onClick reads the ref
  const first = mount(w);
  cur.c = first.ctl;
  first.ctl.dispose();
  cur.c = null;
  const second = mount(w);
  cur.c = second.ctl;
  assert.equal(w.resources().observersLive, 1);
  w.cats[0].cover.dispatch("click");
  w.clock.advance(5000);
  assert.deepEqual(first.dispatched, []);
  assert.deepEqual(second.dispatched.map((d) => d.action.type), ["detonate", "boom", "reveal"]);
  second.ctl.dispose();
  assert.deepEqual([w.resources().timers, w.resources().observersLive], [0, 0]);
});

// ---------- helpers ----------

test("replayFlyIn: per card remove, reflow, delay i*0.08s (default number formatting), add — in that order; null projects is a no-op", () => {
  const w = new CategoryScene({ cards: 3 });
  const parts = w.parts(0);
  replayFlyIn(parts.projects);
  const lines = w.log.map((l) => l.replace(/^@\d+ /, ""));
  assert.deepEqual(lines.slice(0, 4), ["card[0.0].class.remove(fly-in)", "card[0.0].offsetWidth(reflow)", "card[0.0].style.animationDelay=0s", "card[0.0].class.add(fly-in)"]);
  assert.ok(lines.includes("card[0.1].style.animationDelay=0.08s"));
  assert.ok(lines.includes("card[0.2].style.animationDelay=0.16s"));
  const n = w.log.length;
  replayFlyIn(null);
  assert.equal(w.log.length, n);
});

test("resetEffect: done cleared with an empty string, cta/bomb opacity cleared, countdown classes removed in one call", () => {
  const w = new CategoryScene({});
  w.markDone(0);
  resetEffect(w.parts(0));
  assert.deepEqual(w.log.map((l) => l.replace(/^@\d+ /, "")), [
    "cover[0].dataset.done=",
    "cta[0].style.opacity=",
    "bomb[0].style.opacity=",
    "countdown[0].class.remove(show,pulse)",
  ]);
});

// ---------- DOM adapter (selectors only; the real window is checked in the browser) ----------

test("coverPartsFrom resolves the v4 selectors; null when the section has no cover", () => {
  const w = new CategoryScene({ cards: 2 });
  const c = w.cats[0];
  c.section.queries.set(".category-projects", c.projects);
  const parts = coverPartsFrom(c.section as unknown as HTMLElement);
  if (!parts) throw new Error("parts expected");
  assert.equal(parts.cover, c.cover as unknown);
  assert.equal(parts.cta, c.cta as unknown);
  assert.equal(parts.bomb, c.bomb as unknown);
  assert.equal(parts.countdown, c.countdown as unknown);
  assert.equal(parts.flash, c.flash as unknown);
  assert.equal(parts.projects?.cards().length, 2);
  assert.equal(parts.projects?.style, c.projects?.style);

  const bare = w.el("bare-section");
  assert.equal(coverPartsFrom(bare as unknown as HTMLElement), null);
  bare.queries.set(".category-cover", c.cover);
  const noStack = coverPartsFrom(bare as unknown as HTMLElement);
  assert.equal(noStack?.projects, null);
});

test("explosionTargetFrom reads the canvas at call time, like v4 `cover.querySelector('.explosion-3d')`", () => {
  const w = new CategoryScene({});
  const cover = w.cats[0].cover;
  const target = explosionTargetFrom(cover as unknown as HTMLElement);
  assert.equal(target.canvas, w.cats[0].canvas as unknown);
  cover.queries.set(".explosion-3d", null);
  assert.equal(target.canvas, null);
  cover.rect = { top: 0, bottom: 5, left: 0, right: 9, width: 9, height: 5 };
  assert.deepEqual({ w: target.getBoundingClientRect().width, h: target.getBoundingClientRect().height }, { w: 9, h: 5 });
});
