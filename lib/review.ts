// STATUS: UNVERIFIED (Claude proposal). v4 review form logic (index.html ~2889-2921) as pure functions. Endpoint: POST {API_BASE}/reviews (v4 used relative api/reviews).
import type { Lang } from "./content";
import { apiUrl, type FetchLike } from "./api-base";

export interface ReviewPayload { name: string; role: string; text: string; website: string }   // website = honeypot, must stay empty
export type ReviewError = "name" | "text" | null;
export const REVIEW_MAX = 500;

export function validateReview(p: ReviewPayload): ReviewError {
  if (p.name.length < 2) return "name";
  if (p.text.length < 10) return "text";
  return null;
}
export const reviewCount = (len: number) => `${len} / ${REVIEW_MAX}`;

export type ReviewOutcome = { kind: "done" } | { kind: "problem"; detail?: string; status: 422 | 429 } | { kind: "fallback" };
/** v4 mapping: ok -> done; 429 -> problem (server detail if a string); 422 -> problem; any other status or network error -> WhatsApp fallback. */
export async function submitReview(f: FetchLike, base: string | null, p: ReviewPayload): Promise<ReviewOutcome> {
  if (!base) return { kind: "fallback" };
  try {
    const r = await f(apiUrl(base, "/reviews"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    if (r.ok) return { kind: "done" };
    if (r.status === 429) { const j = (await r.json().catch(() => ({}))) as { detail?: unknown }; return { kind: "problem", status: 429, detail: typeof j.detail === "string" ? j.detail : undefined }; }
    if (r.status === 422) return { kind: "problem", status: 422 };
  } catch { /* no server */ }
  return { kind: "fallback" };
}

const WA_LABELS: Record<Lang, { head: string; name: string; role: string; text: string }> = {
  ar: { head: "رأي جديد", name: "الاسم: ", role: "الصفة: ", text: "الرأي: " },
  en: { head: "New review", name: "Name: ", role: "Role: ", text: "Review: " },
};
/** ar output is byte-identical to v4. Language follows the UI (owner decision). */
export function reviewWhatsappHref(waNumber: string, p: ReviewPayload, lang: Lang): string {
  const L = WA_LABELS[lang];
  const msg = L.head + "\n" + L.name + p.name + (p.role ? "\n" + L.role + p.role : "") + "\n" + L.text + p.text;
  return "https://wa.me/" + waNumber.replace(/\D/g, "") + "?text=" + encodeURIComponent(msg);
}
