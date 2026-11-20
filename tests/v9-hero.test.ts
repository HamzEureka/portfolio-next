import test from "node:test";
import assert from "node:assert/strict";
import { World, runOriginal, settle, type Cfg } from "./helpers/enh-harness";
import { heroMediaPlan, mountHeroMedia } from "../lib/hero-media";

const CONNS: Array<Cfg["connection"]> = [undefined, { saveData: true }, { effectiveType: "2g" }, { effectiveType: "slow-2g" }, { effectiveType: "3g" }, { effectiveType: "4g" }, { saveData: false, effectiveType: "4g" }];
const POSTER = "assets/hero-poster.jpg", VIDEO = "assets/hero-loop.mp4";

async function pair(cfg: Cfg) {
  const a = new World(cfg); await runOriginal(a); await settle();
  const b = new World(cfg);
  const off = mountHeroMedia(b.env, b.hero as any, POSTER, VIDEO); await settle();
  return { a, b, off };
}
const same = (a: World, b: World, label: string) => assert.deepEqual(b.hero!.snap(), a.hero!.snap(), label);

test("hero: initial structure equals v4 for every media/connection/IO combination", async () => {
  for (const reduce of [false, true]) for (const small of [false, true]) for (const connection of CONNS) for (const noIO of [false, true]) for (const videoPlay of ["ok", "reject"] as const) {
    const cfg: Cfg = { reduce, small, connection, noIO, videoPlay };
    const { a, b } = await pair(cfg);
    same(a, b, JSON.stringify(cfg));
    assert.equal(b.io.length, a.io.length, "IntersectionObserver created: " + JSON.stringify(cfg));
  }
});

test("hero: events (poster load/error, video canplay/error, off-screen pause/play) behave like v4", async () => {
  const cfg: Cfg = {};   // large screen, video path
  const { a, b } = await pair(cfg);
  const poster = (w: World) => w.hero!.find((e) => e.tag === "img")!, video = (w: World) => w.hero!.find((e) => e.tag === "video")!;
  poster(a).fire("load"); poster(b).fire("load"); same(a, b, "poster load");
  video(a).fire("canplay"); video(b).fire("canplay"); same(a, b, "canplay");
  for (const vis of [false, true, false]) {
    a.io[0].cb([{ isIntersecting: vis }]); b.io[0].cb([{ isIntersecting: vis }]); await settle();
    assert.deepEqual([video(b).played, video(b).paused], [video(a).played, video(a).paused], "IO " + vis);
  }
  assert.deepEqual(b.io[0].observed.length, a.io[0].observed.length);
  video(a).fire("error"); video(b).fire("error"); same(a, b, "video error -> removed + kb");
  poster(a).fire("error"); poster(b).fire("error"); assert.equal(a.hero!.kids.length, b.hero!.kids.length, "poster error removes the wrapper");
});

test("hero: no hero element, and teardown, are safe", async () => {
  const b = new World({});
  const off = mountHeroMedia(b.env, b.hero as any, POSTER, VIDEO);
  assert.equal(b.hero!.kids.length, 1); off(); assert.equal(b.hero!.kids.length, 0);
  assert.equal(b.io[0].disconnected, true);
});

test("heroMediaPlan decision table", () => {
  assert.equal(heroMediaPlan({ reduce: true, small: false }), "poster-only");
  assert.equal(heroMediaPlan({ reduce: false, small: true }), "kb");
  assert.equal(heroMediaPlan({ reduce: false, small: false, saveData: true }), "kb");
  assert.equal(heroMediaPlan({ reduce: false, small: false, effectiveType: "slow-2g" }), "kb");
  assert.equal(heroMediaPlan({ reduce: false, small: false, effectiveType: "3g" }), "video");
  assert.equal(heroMediaPlan({ reduce: false, small: false }), "video");
});
