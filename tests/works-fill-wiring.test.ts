// STATUS: UNVERIFIED (Claude draft; M6/T7b; run in the cloud sandbox only, not yet on the owner's machine)
/** T7b: mountBrowserFillHeading (lib/works-ui/dom.ts) with fake window/document globals; the math itself is covered by works-fill-heading.test.ts. */
import test from "node:test";
import assert from "node:assert/strict";
import { FillScene } from "./helpers/works-harness";
import { mountBrowserFillHeading } from "../lib/works-ui/dom";

type G = { window?: unknown; document?: unknown };
function withGlobals<T>(w: FillScene, reduce: boolean, hasHeading: boolean, fn: () => T): T {
  const g = globalThis as unknown as G;
  const saved = { window: g.window, document: g.document };
  g.window = new Proxy(w.win(), { get: (t, p) => (p === "matchMedia" ? () => ({ matches: reduce }) : (t as unknown as Record<string | symbol, unknown>)[p]) });
  g.document = { getElementById: (id: string) => (hasHeading ? w.byId.get(id) ?? null : null) };
  try { return fn(); } finally { g.window = saved.window; g.document = saved.document; }
}

test("mounts on #portfolioFillHeading: first update writes the clip-path, scroll updates it, teardown leaves nothing", () => {
  const w = new FillScene({ top: 1000 });
  const off = withGlobals(w, false, true, () => mountBrowserFillHeading());
  if (!off) throw new Error("mount expected");
  assert.equal(w.fill.style.clipPath, "inset(0 100% 0 0)");
  w.apply({ op: "top", v: 0 });
  w.apply({ op: "scroll" });
  w.apply({ op: "frame" });
  assert.equal(w.fill.style.clipPath, "inset(0 0% 0 0)");
  assert.deepEqual([w.resources().scroll, w.resources().resize], [1, 1]);
  off();
  assert.deepEqual([w.resources().scroll, w.resources().resize, w.resources().frames], [0, 0, 0]);
});

test("prefers-reduced-motion: nothing is registered and nothing is written", () => {
  const w = new FillScene({ reduceMotion: true });
  const off = withGlobals(w, true, true, () => mountBrowserFillHeading());
  if (!off) throw new Error("mount expected");
  assert.deepEqual([w.resources().scroll, w.resources().resize], [0, 0]);
  assert.equal(w.log.length, 0);
  off();
});

test("no heading: returns null (v4 skipped the block)", () => {
  const w = new FillScene({});
  assert.equal(withGlobals(w, false, false, () => mountBrowserFillHeading()), null);
  assert.equal(w.log.length, 0);
});

test("heading without .sfh-fill: returns null instead of throwing", () => {
  const w = new FillScene({});
  w.heading.queries.set(".sfh-fill", null);
  assert.equal(withGlobals(w, false, true, () => mountBrowserFillHeading()), null);
});
