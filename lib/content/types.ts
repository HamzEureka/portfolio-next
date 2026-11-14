export type Lang = "ar" | "en";
export const LANGS: Lang[] = ["ar", "en"];
export const DEFAULT_LANG: Lang = "ar";

/** A translatable string. `en` falls back to `ar` when absent (names/quotes are intentionally untranslated). */
export interface LText { ar: string; en?: string }

/** Media slot: every image/video in the site is one of these, addressed by a dot key (e.g. "about.photo"). */
export interface MediaSlot { id: string; url: string; type: "image" | "video"; alt?: string }

export interface Paragraph { id: string; text: LText }
export interface Stat { id: string; n: string; label: LText }
export interface Skill { id: string; name: string; percent: number; badge?: string; icon?: string }
export interface Category { id: string; label: LText; cta: LText }
export interface Work {
  id: string; category: string; order: number;
  title: LText; desc: LText; tag: LText | null;
  video: string; poster: string | null;
}
export interface Step { id: string; title: LText; text: LText }
export interface Testimonial { id: string; text: LText; name: LText; role: LText }
export interface ContactLink { id: "email" | "whatsapp" | "instagram" | "facebook"; value: string }
export interface BriefOption { id: string; value: string; label: LText }

/** Collection name -> item type. Collections are ordered arrays of items with a unique `id`. */
export interface Collections {
  "about.paragraphs": Paragraph;
  "about.stats": Stat;
  "skills": Skill;
  "works.categories": Category;
  "works": Work;
  "process": Step;
  "testimonials": Testimonial;
  "contact.links": ContactLink;
  "brief.projectTypes": BriefOption;
  "brief.footage": BriefOption;
  "brief.platforms": BriefOption;
  "brief.durations": BriefOption;
  "brief.budgets": BriefOption;
}
export type CollectionName = keyof Collections;

export interface ContentData {
  texts: Record<string, LText>;
  media: Record<string, MediaSlot>;
  collections: { [K in CollectionName]: Collections[K][] };
}
