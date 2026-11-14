import type { CollectionName, Collections, ContentData, LText, MediaSlot } from "./types";

/**
 * ContentStore = the CRUD contract for the whole site (texts, media, collections).
 * The UI only talks to this interface, so the JSON-file implementation below can be swapped
 * for an HTTP client to the Python/SQLite server later without touching components.
 */
export interface ContentStore {
  // texts (singletons addressed by dot key)
  getText(key: string): Promise<LText | undefined>;
  listTexts(): Promise<Record<string, LText>>;
  setText(key: string, value: LText): Promise<LText>;       // create or update
  deleteText(key: string): Promise<boolean>;
  // media slots
  getMedia(key: string): Promise<MediaSlot | undefined>;
  listMedia(): Promise<Record<string, MediaSlot>>;
  setMedia(key: string, slot: Omit<MediaSlot, "id">): Promise<MediaSlot>;
  deleteMedia(key: string): Promise<boolean>;
  // collections
  list<K extends CollectionName>(name: K): Promise<Collections[K][]>;
  get<K extends CollectionName>(name: K, id: string): Promise<Collections[K] | undefined>;
  create<K extends CollectionName>(name: K, item: Collections[K]): Promise<Collections[K]>;
  update<K extends CollectionName>(name: K, id: string, patch: Partial<Collections[K]>): Promise<Collections[K]>;
  remove<K extends CollectionName>(name: K, id: string): Promise<boolean>;
}

export class NotFoundError extends Error {}
export class ConflictError extends Error {}

/** In-memory store over a ContentData snapshot. `persist` is called after every mutation. */
export class MemoryStore implements ContentStore {
  constructor(protected data: ContentData, private persist?: (d: ContentData) => Promise<void> | void) {}
  protected async save() { await this.persist?.(this.data); }

  async getText(key: string) { return this.data.texts[key]; }
  async listTexts() { return { ...this.data.texts }; }
  async setText(key: string, value: LText) { this.data.texts[key] = value; await this.save(); return value; }
  async deleteText(key: string) { const had = key in this.data.texts; delete this.data.texts[key]; await this.save(); return had; }

  async getMedia(key: string) { return this.data.media[key]; }
  async listMedia() { return { ...this.data.media }; }
  async setMedia(key: string, slot: Omit<MediaSlot, "id">) {
    const m = { ...slot, id: key }; this.data.media[key] = m; await this.save(); return m;
  }
  async deleteMedia(key: string) { const had = key in this.data.media; delete this.data.media[key]; await this.save(); return had; }

  private arr<K extends CollectionName>(name: K) { return this.data.collections[name] as Collections[K][]; }
  async list<K extends CollectionName>(name: K) { return [...this.arr(name)]; }
  async get<K extends CollectionName>(name: K, id: string) { return this.arr(name).find((x) => x.id === id); }
  async create<K extends CollectionName>(name: K, item: Collections[K]) {
    const a = this.arr(name);
    if (a.some((x) => x.id === item.id)) throw new ConflictError(`${name}/${item.id} already exists`);
    a.push(item); await this.save(); return item;
  }
  async update<K extends CollectionName>(name: K, id: string, patch: Partial<Collections[K]>) {
    const a = this.arr(name), i = a.findIndex((x) => x.id === id);
    if (i < 0) throw new NotFoundError(`${name}/${id} not found`);
    a[i] = { ...a[i], ...patch, id }; await this.save(); return a[i];
  }
  async remove<K extends CollectionName>(name: K, id: string) {
    const a = this.arr(name), i = a.findIndex((x) => x.id === id);
    if (i < 0) return false;
    a.splice(i, 1); await this.save(); return true;
  }
}
