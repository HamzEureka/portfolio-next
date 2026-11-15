// STATUS: UNVERIFIED (DeepSeek draft, reviewed by Claude; tsx --test + tsc passed in the cloud sandbox only, not yet on the owner's machine)
/**
 * W1 (pure): focused stack card index (v4 site/index.html:2301-2318).
 *
 * QUIRKS preserved:
 * - Iteration is from the LAST card to the FIRST, so when several cards qualify the highest index wins.
 * - `rectAt(i)` is read lazily and the loop stops at the first match: cards before the winner are never read.
 * - The two literals are `+ 2` and `+ 40` on top of STICKY_TOP (index.html:2313).
 *
 * DEVIATIONS: none (pure function, same loop, same literals).
 */
import type { RectLike } from "./contract";

// SOURCE: index.html:2306
export const STICKY_TOP = 96;

// SOURCE: index.html:2310-2318
/** Index of the stack card whose rect covers the sticky band, scanning from the end; -1 when none. */
export function focusedIndex(count: number, rectAt: (i: number) => RectLike): number {
  for (let i = count - 1; i >= 0; i--) {
    const rect = rectAt(i);
    if (rect.top <= STICKY_TOP + 2 && rect.bottom > STICKY_TOP + 40) {
      return i;
    }
  }
  return -1;
}
