import test from "node:test";
import assert from "node:assert/strict";
import { World, runOriginal, FEl } from "./helpers/enh-harness";
import { mountScrollProgress, progressRatio } from "../lib/scroll-progress";

const SCENES = [
  { scrollHeight: 5000, innerHeight: 800, ys: [0, 1, 100, 2100, 4199, 4200, 4201, 6000] },
  { scrollHeight: 800, innerHeight: 800, ys: [0, 50] },                         // not scrollable
  { scrollHeight: 700, innerHeight: 800, ys: [0, 10] },                         // shorter than viewport
  { scrollHeight: 12345, innerHeight: 667, ys: [0, 333, 5000, 11678] },
];

test("progress: transform after every scroll/resize equals v4, and one rAF per frame", async () => {
  for (const sc of SCENES) {
    const a = new World({ scrollHeight: sc.scrollHeight, innerHeight: sc.innerHeight, noHero: true }); await runOriginal(a);
    const abar = a.body.find((e) => e.attrs.id === "scrollProgress")!;
    const b = new World({ scrollHeight: sc.scrollHeight, innerHeight: sc.innerHeight, noHero: true });
    const bbar = new FEl("div"); bbar.style.transform = "";
    mountScrollProgress({ win: b.g, doc: b.g.document, requestAnimationFrame: b.g.requestAnimationFrame }, bbar as any);
    assert.equal(bbar.style.transform, abar.style.transform, "initial");
    for (const y of sc.ys) {
      a.set({ scrollY: y }); b.set({ scrollY: y });
      a.fireWin("scroll"); a.fireWin("scroll"); b.fireWin("scroll"); b.fireWin("scroll");   // two events in one frame
      a.flushRaf(); b.flushRaf();
      assert.equal(bbar.style.transform, abar.style.transform, `y=${y} ${JSON.stringify(sc)}`);
    }
    a.set({ innerHeight: sc.innerHeight + 300 }); b.set({ innerHeight: sc.innerHeight + 300 });
    a.fireWin("resize"); b.fireWin("resize");
    assert.equal(bbar.style.transform, abar.style.transform, "resize");
    assert.equal(b.rafRequests, a.rafRequests, "rAF requests (coalescing)");
  }
});

test("progress: same listeners (scroll passive, resize) and teardown removes them", async () => {
  const a = new World({ noHero: true }); await runOriginal(a);
  const b = new World({ noHero: true });
  const off = mountScrollProgress({ win: b.g, doc: b.g.document, requestAnimationFrame: b.g.requestAnimationFrame }, new FEl("div") as any);
  const shape = (w: World) => w.winHandlers.filter((h) => h.type === "scroll" || h.type === "resize").map((h) => [h.type, JSON.stringify(h.opts ?? null)]).sort();
  assert.deepEqual(shape(b), shape(a));
  off();
  assert.deepEqual(b.winHandlers.filter((h) => h.type === "scroll" || h.type === "resize"), []);
});

test("progressRatio edge cases", () => {
  assert.equal(progressRatio(0, 800, 800), 0);
  assert.equal(progressRatio(5000, 5000, 800), 1);
  assert.equal(progressRatio(2100, 5000, 800), 0.5);
});
