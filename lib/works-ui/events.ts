// STATUS: UNVERIFIED (Claude draft; M5/T7; not run in a browser)
/** Close Category -> playback controller. A window event keeps the per-category component and the page-wide controller apart. */
export const WORKS_CLOSE_EVENT = "portfolio:works-close";

export function emitWorksClose(target: Pick<EventTarget, "dispatchEvent">, category: string): void {
  target.dispatchEvent(new CustomEvent(WORKS_CLOSE_EVENT, { detail: { category } }));
}

/** Indexes of the cards (page-wide DOM order) that belong to `category`; `categoryOfCard[i]` = data-cat of card i. */
export function cardIndexesOf(categoryOfCard: readonly string[], category: string): number[] {
  const out: number[] = [];
  categoryOfCard.forEach((c, i) => { if (c === category) out.push(i); });
  return out;
}
