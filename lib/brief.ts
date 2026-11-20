// STATUS: UNVERIFIED (Claude draft)
/**
 * Pure logic of the "request a quote" form (v10). No DOM, no React, no window.
 *
 * Parity target #1 (done in tests/brief.test.ts): the submit() handler of components/BriefDialog.tsx
 * as it is in the project today, kept verbatim in tests/fixtures/brief-dialog-submit.js.
 * Parity target #2 (NOT done, needs yousef-portfolio-v4.zip): the original v4 submit() of index.html
 * (modal.brief) and of Brief.html.
 *
 * QUIRKS kept from the current code (do not "fix" without an owner decision):
 * - Only name, whatsapp, ptype and duration are required; there is no phone-format validation.
 * - Message labels are Arabic by design (BriefDialog comment). v8 may pass localized `labels`.
 * - wa.me number = every non-digit removed. Arabic-Indic digits are REMOVED, not converted, and an
 *   empty number gives "https://wa.me/?text=...". Both are kept as in the original.
 * - Optional lines are added when the value is truthy; platforms are joined with the Arabic comma.
 * - ptype and footage values are NOT trimmed (they come from radio inputs); every other text value is.
 */

export interface BriefValues {
  name: string;
  whatsapp: string;
  /** Checked radio value of `ptype`, "" when none is checked. */
  ptype: string;
  duration: string;
  count: string;
  /** Checked radio value of `footage`, "" when none is checked. */
  footage: string;
  platforms: readonly string[];
  ref: string;
  deadline: string;
  budget: string;
  notes: string;
}

export type BriefRequired = "name" | "whatsapp" | "ptype" | "duration";
export const BRIEF_REQUIRED: readonly BriefRequired[] = ["name", "whatsapp", "ptype", "duration"];

export type BriefValidation = { ok: true } | { ok: false; missing: BriefRequired[] };

/** Same truthiness test as the original: `!name || !wa || !ptype || !duration`. */
export function validateBrief(v: Pick<BriefValues, BriefRequired>): BriefValidation {
  const missing = BRIEF_REQUIRED.filter((k) => !v[k]);
  return missing.length ? { ok: false, missing } : { ok: true };
}

/** Values as read from the form, before trimming. Missing radio values may be undefined. */
export interface BriefRaw {
  name?: string; whatsapp?: string; ptype?: string; duration?: string; count?: string; footage?: string;
  platforms?: readonly string[]; ref?: string; deadline?: string; budget?: string; notes?: string;
}

/** Trims the text fields like the original `v(name)` reader; ptype and footage stay as they are. */
export function normalizeBrief(raw: BriefRaw): BriefValues {
  const t = (s: string | undefined): string => (s ?? "").trim();
  return {
    name: t(raw.name), whatsapp: t(raw.whatsapp), ptype: raw.ptype ?? "", duration: t(raw.duration),
    count: t(raw.count), footage: raw.footage ?? "", platforms: [...(raw.platforms ?? [])],
    ref: t(raw.ref), deadline: t(raw.deadline), budget: t(raw.budget), notes: t(raw.notes),
  };
}

/** Line prefixes of the message (each one includes its colon and space). */
export interface BriefLabels {
  title: string; name: string; whatsapp: string; ptype: string; duration: string; count: string;
  footage: string; platforms: string; ref: string; deadline: string; budget: string; notes: string;
  platformsSeparator: string;
}

export const BRIEF_LABELS_AR: BriefLabels = {
  title: "طلب عرض سعر جديد",
  name: "الاسم: ",
  whatsapp: "واتساب: ",
  ptype: "نوع المشروع: ",
  duration: "مدة الفيديو: ",
  count: "عدد الفيديوهات: ",
  footage: "المادة الخام: ",
  platforms: "المنصات: ",
  ref: "مرجعية بصرية: ",
  deadline: "تاريخ التسليم المطلوب: ",
  budget: "الميزانية التقريبية: ",
  notes: "تفاصيل إضافية: ",
  platformsSeparator: "، ",
};

/** The WhatsApp message. `v` must already be valid (see validateBrief) and trimmed (see normalizeBrief). */
export function buildWhatsappMessage(v: BriefValues, labels: BriefLabels = BRIEF_LABELS_AR): string {
  const lines = [
    labels.title, "",
    labels.name + v.name, labels.whatsapp + v.whatsapp, labels.ptype + v.ptype, labels.duration + v.duration,
  ];
  if (v.count) lines.push(labels.count + v.count);
  if (v.footage) lines.push(labels.footage + v.footage);
  if (v.platforms.length) lines.push(labels.platforms + v.platforms.join(labels.platformsSeparator));
  if (v.ref) lines.push(labels.ref + v.ref);
  if (v.deadline) lines.push(labels.deadline + v.deadline);
  if (v.budget) lines.push(labels.budget + v.budget);
  if (v.notes) lines.push(labels.notes + v.notes);
  return lines.join("\n");
}

/** `https://wa.me/<digits>?text=<encoded message>` exactly as the original built it. */
export function buildWaLink(number: string, message: string): string {
  return "https://wa.me/" + number.replace(/\D/g, "") + "?text=" + encodeURIComponent(message);
}

export type BriefRequest =
  | { ok: false; missing: BriefRequired[] }
  | { ok: true; message: string; url: string };

/** Whole flow for a component: normalize, validate, build message and link. */
export function composeBriefRequest(raw: BriefRaw, waNumber: string, labels: BriefLabels = BRIEF_LABELS_AR): BriefRequest {
  const v = normalizeBrief(raw);
  const check = validateBrief(v);
  if (!check.ok) return check;
  const message = buildWhatsappMessage(v, labels);
  return { ok: true, message, url: buildWaLink(waNumber, message) };
}
