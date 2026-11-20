// STATUS: UNVERIFIED (DeepSeek draft, reviewed by Claude; independent second suite, run in the cloud sandbox only)
/**
 * W1 (pure): focusedIndex against the literal loop of site/index.html:2310-2318.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { focusedIndex, STICKY_TOP } from "../lib/works/focus";
import type { RectLike } from "../lib/works/contract";

const r = (top: number, bottom: number): RectLike => ({ top, bottom });

test("STICKY_TOP keeps its v4 value (index.html:2306)", () => {
  assert.equal(STICKY_TOP, 96);
});

test("top boundary: 96+2 matches, 96+3 does not", () => {
  assert.equal(focusedIndex(1, () => r(98, 700)), 0); // top === STICKY_TOP + 2
  assert.equal(focusedIndex(1, () => r(99, 700)), -1); // top === STICKY_TOP + 3
});

test("bottom boundary: 96+40 strictly greater matches, equal does not", () => {
  assert.equal(focusedIndex(1, () => r(0, 137)), 0); // bottom === STICKY_TOP + 41
  assert.equal(focusedIndex(1, () => r(0, 136)), -1); // bottom === STICKY_TOP + 40
});

test("both conditions must hold", () => {
  assert.equal(focusedIndex(1, () => r(200, 700)), -1); // top too far
  assert.equal(focusedIndex(1, () => r(0, 100)), -1); // bottom too small
  assert.equal(focusedIndex(1, () => r(98, 137)), 0); // both exactly on the edge
});

test("empty list returns -1 and never calls rectAt", () => {
  let calls = 0;
  const result = focusedIndex(0, () => {
    calls++;
    return r(0, 700);
  });
  assert.equal(result, -1);
  assert.equal(calls, 0);
});

test("last match wins when several cards qualify", () => {
  // All four qualify: iteration starts at 3.
  assert.equal(focusedIndex(4, () => r(0, 700)), 3);
  // Only 1 and 2 qualify: 2 is the first seen from the end.
  assert.equal(
    focusedIndex(4, (i) => (i === 1 || i === 2 ? r(0, 700) : r(2000, 2600))),
    2,
  );
});

test("lazy reads: stops at the first qualifying card from the end", () => {
  const reads: number[] = [];
  const result = focusedIndex(5, (i) => {
    reads.push(i);
    return i === 2 ? r(0, 700) : r(2000, 2600);
  });
  assert.equal(result, 2);
  assert.deepEqual(reads, [4, 3, 2]);
});

test("lazy reads: when none qualify every index is read end-to-start", () => {
  const reads: number[] = [];
  focusedIndex(4, (i) => {
    reads.push(i);
    return r(2000, 2600);
  });
  assert.deepEqual(reads, [3, 2, 1, 0]);
});
