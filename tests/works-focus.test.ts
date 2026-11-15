// STATUS: UNVERIFIED (Claude draft; run in the cloud sandbox only, not yet on the owner's machine)
/** W1 pure part: lib/works/focus.ts against the rules of getFocusedIndex (v4 site/index.html:2310-2318). */
import test from "node:test";
import assert from "node:assert/strict";
import { same } from "./helpers/works-harness";
import { STICKY_TOP, focusedIndex } from "../lib/works/focus";
import type { RectLike } from "../lib/works/contract";

const rects = (list: RectLike[]) => (i: number) => list[i];
const R = (top: number, bottom: number): RectLike => ({ top, bottom });

test("STICKY_TOP keeps its v4 value (index.html:2306)", () => {
  assert.equal(STICKY_TOP, 96);
});

test("top boundary: <= STICKY_TOP + 2 qualifies, +3 does not", () => {
  same(focusedIndex(1, rects([R(98, 700)])), 0);
  same(focusedIndex(1, rects([R(99, 700)])), -1);
  same(focusedIndex(1, rects([R(-500, 700)])), 0);
});

test("bottom boundary: > STICKY_TOP + 40 qualifies, == does not", () => {
  same(focusedIndex(1, rects([R(96, 137)])), 0);
  same(focusedIndex(1, rects([R(96, 136)])), -1);
  same(focusedIndex(1, rects([R(96, 0)])), -1);
});

test("the last qualifying card wins", () => {
  same(focusedIndex(3, rects([R(0, 700), R(50, 700), R(96, 700)])), 2);
  same(focusedIndex(3, rects([R(0, 700), R(50, 700), R(300, 900)])), 1);
});

test("-1 when no card qualifies and for an empty list", () => {
  same(focusedIndex(3, rects([R(300, 900), R(400, 900), R(500, 900)])), -1);
  same(focusedIndex(0, () => R(0, 700)), -1);
});

test("rects are read lazily from the last card backwards, stopping at the first match", () => {
  const read: number[] = [];
  const list = [R(0, 700), R(0, 700), R(500, 900), R(500, 900)];
  const idx = focusedIndex(4, (i) => (read.push(i), list[i]));
  same(idx, 1);
  same(read, [3, 2, 1]);
  const read2: number[] = [];
  focusedIndex(3, (i) => (read2.push(i), R(900, 1200)));
  same(read2, [2, 1, 0]);
});

test("mutants: wrong offsets or scan direction change the answer", () => {
  const buggy = (count: number, at: (i: number) => RectLike, topOff: number, botOff: number, reverse: boolean): number => {
    const order = [...Array(count).keys()];
    if (reverse) order.reverse();
    for (const i of order) {
      const r = at(i);
      if (r.top <= STICKY_TOP + topOff && r.bottom > STICKY_TOP + botOff) return i;
    }
    return -1;
  };
  const cases: RectLike[][] = [[R(98, 700)], [R(99, 700)], [R(96, 137)], [R(96, 136)], [R(0, 700), R(50, 700)]];
  const differs = (topOff: number, botOff: number, reverse: boolean) =>
    cases.some((c) => buggy(c.length, rects(c), topOff, botOff, reverse) !== focusedIndex(c.length, rects(c)));
  assert.equal(differs(2, 40, true), false, "sanity: the mutant with no defect agrees");
  assert.equal(differs(0, 40, true), true);
  assert.equal(differs(2, 0, true), true);
  assert.equal(differs(2, 40, false), true);
});
