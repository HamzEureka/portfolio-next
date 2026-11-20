import test from "node:test";
import assert from "node:assert/strict";
import { desktopScrollTarget } from "../lib/spotlight";

test("desktopScrollTarget: n=1 is finite (was NaN); n>1 unchanged", () => {
  assert.equal(desktopScrollTarget(0, 1, 100, 1000), 100 + 0.08 * 1000);
  assert.equal(desktopScrollTarget(0, 4, 0, 1000), 80);
  assert.ok(Math.abs((desktopScrollTarget(3, 4, 0, 1000) as number) - 920) < 1e-9);
  assert.equal(desktopScrollTarget(0, 1, 0, 0), null);
});
