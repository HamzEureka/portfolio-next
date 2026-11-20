// STATUS: UNVERIFIED (Claude proposal; sandbox tests only, not run on the owner machine)
import type { LText, MediaSlot } from "./types";

/** Additive patch for content/seed.json. Only NEW keys/ids are applied; existing values are never overwritten silently. */
export interface SeedAdditions {
  texts?: Record<string, LText>;
  media?: Record<string, Omit<MediaSlot, "id"> & { id?: string }>;
  collections?: Record<string, Array<{ id: string }>>;
}

export interface MergeReport {
  addedTexts: string[];
  addedMedia: string[];
  addedItems: string[];      // "<collection>/<id>"
  identical: string[];       // already present with the same value
  conflicts: string[];       // already present with a DIFFERENT value (not applied unless force)
  unknownCollections: string[];
}

type Seed = { texts: Record<string, LText>; media: Record<string, MediaSlot>; collections: Record<string, Array<{ id: string }>> } & Record<string, unknown>;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Pure: returns a merged copy of `seed` plus a report. Input objects are not mutated. */
export function mergeAdditions<T extends Seed>(seed: T, add: SeedAdditions, opts: { force?: boolean } = {}): { data: T; report: MergeReport } {
  const data = structuredClone(seed) as T;
  const r: MergeReport = { addedTexts: [], addedMedia: [], addedItems: [], identical: [], conflicts: [], unknownCollections: [] };

  for (const [k, v] of Object.entries(add.texts ?? {})) {
    if (k in data.texts) {
      if (same(data.texts[k], v)) r.identical.push(`texts/${k}`);
      else { r.conflicts.push(`texts/${k}`); if (opts.force) data.texts[k] = v; }
    } else { data.texts[k] = v; r.addedTexts.push(k); }
  }
  for (const [k, v] of Object.entries(add.media ?? {})) {
    const slot = { ...v, id: k } as MediaSlot;
    if (k in data.media) {
      if (same(data.media[k], slot)) r.identical.push(`media/${k}`);
      else { r.conflicts.push(`media/${k}`); if (opts.force) data.media[k] = slot; }
    } else { data.media[k] = slot; r.addedMedia.push(k); }
  }
  for (const [name, items] of Object.entries(add.collections ?? {})) {
    const arr = data.collections[name];
    if (!arr) { r.unknownCollections.push(name); continue; }
    for (const it of items) {
      const i = arr.findIndex((x) => x.id === it.id);
      if (i < 0) { arr.push(it); r.addedItems.push(`${name}/${it.id}`); }
      else if (same(arr[i], it)) r.identical.push(`${name}/${it.id}`);
      else { r.conflicts.push(`${name}/${it.id}`); if (opts.force) arr[i] = it; }
    }
  }
  return { data, report: r };
}

/** Same serialisation as the committed seed (2-space JSON + trailing newline). */
export const serializeSeed = (d: unknown): string => JSON.stringify(d, null, 2) + "\n";
