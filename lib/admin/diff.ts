// STATUS: UNVERIFIED (Claude proposal). Turns "before / after" of a collection into the minimal set of API calls.
import type { Item } from "./schema";
import type { AdminApi } from "./api";

export interface CollectionOps { puts: Item[]; deletes: string[]; reorder: string[] | null }
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function diffCollection(before: Item[], after: Item[]): CollectionOps {
  const b = new Map(before.map((i) => [i.id, i]));
  const kept = new Set(after.map((i) => i.id));
  const puts = after.filter((i) => !b.has(i.id) || !eq(b.get(i.id), i));
  const deletes = before.filter((i) => !kept.has(i.id)).map((i) => i.id);
  const keptBefore = before.filter((i) => kept.has(i.id)).map((i) => i.id);
  const order = after.map((i) => i.id);
  const added = after.some((i) => !b.has(i.id));
  return { puts, deletes, reorder: added || !eq(keptBefore, order.filter((id) => b.has(id))) ? order : null };
}
export const isEmptyOps = (o: CollectionOps) => !o.puts.length && !o.deletes.length && !o.reorder;

/** deletes -> puts -> order (so an id is never reused before its old row is gone). Stops at the first failure and reports how far it got. */
export async function syncCollection(api: AdminApi, name: string, before: Item[], after: Item[]): Promise<{ done: number; total: number }> {
  const ops = diffCollection(before, after);
  const total = ops.deletes.length + ops.puts.length + (ops.reorder ? 1 : 0);
  let done = 0;
  for (const id of ops.deletes) { await api.deleteItem(name, id); done++; }
  for (const it of ops.puts) { await api.putItem(name, it); done++; }
  if (ops.reorder) { await api.setOrder(name, ops.reorder); done++; }
  return { done, total };
}

export function moveItem<T extends { id: string }>(items: T[], id: string, dir: -1 | 1): T[] {
  const i = items.findIndex((x) => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= items.length) return items;
  const out = items.slice(); [out[i], out[j]] = [out[j], out[i]]; return out;
}
export function newId(prefix: string, existing: Iterable<string>): string {
  const used = new Set(existing); let n = used.size + 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}
