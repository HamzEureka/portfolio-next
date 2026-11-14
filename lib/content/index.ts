import { promises as fs } from "node:fs";
import path from "node:path";
import seed from "@/content/seed.json";
import { MemoryStore, type ContentStore } from "./store";
import type { ContentData, Lang, LText } from "./types";

export * from "./types";
export * from "./store";

const FILE = path.join(process.cwd(), "data", "content.json");

/** Loads data/content.json if present (edited content), otherwise the seed. Writes go to data/content.json. */
export async function getStore(): Promise<ContentStore> {
  let data: ContentData;
  try { data = JSON.parse(await fs.readFile(FILE, "utf8")); }
  catch { data = structuredClone(seed) as unknown as ContentData; }
  return new MemoryStore(data, async (d) => {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(d, null, 2), "utf8");
  });
}

/** Pick the string for a language, falling back to Arabic. */
export const tr = (t: LText | null | undefined, lang: Lang): string => (t ? (lang === "en" ? t.en ?? t.ar : t.ar) : "");
