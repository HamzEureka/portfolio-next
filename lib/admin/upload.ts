// Helpers for the friendly (non-technical) admin: upload checks, Arabic labels, human error messages. Pure functions, no DOM.
import type { Item } from "./schema";

export const DEFAULT_MAX_UPLOAD_MB = 100; // same default as the server (MAX_UPLOAD_MB)
export type UploadKind = "image" | "video";

const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif"];
const VIDEO_EXT = ["mp4", "webm"];
const extOf = (name: string) => (name.split(".").pop() ?? "").toLowerCase();

export const fmtMB = (bytes: number) => `${(bytes / 1048576).toFixed(bytes >= 10 * 1048576 ? 0 : 1)} ميغا`;

/** Returns an Arabic message when the file must not be uploaded, otherwise null. Mirrors the server allow-list (no SVG). */
export function checkUpload(file: { name: string; size: number }, kind: UploadKind, maxMB = DEFAULT_MAX_UPLOAD_MB): string | null {
  const ext = extOf(file.name), ok = kind === "video" ? VIDEO_EXT : IMAGE_EXT;
  if (!ok.includes(ext)) return kind === "video" ? "الملف ليس فيديو مدعوماً. استخدم MP4 أو WebM." : "الملف ليس صورة مدعومة. استخدم JPG أو PNG أو WEBP.";
  if (file.size <= 0) return "الملف فارغ.";
  if (file.size > maxMB * 1048576) return `الملف كبير (${fmtMB(file.size)}). الحد الأقصى ${maxMB} ميغا. قلّل حجمه ثم أعد المحاولة.`;
  return null;
}

/** Which collection fields get an "upload" button instead of a URL box. */
export function uploadKindForField(collection: string, field: string): UploadKind | null {
  if (collection !== "works") return null;
  return field === "video" ? "video" : field === "poster" ? "image" : null;
}

/** Fields the owner never needs to see. */
export const hiddenField = (_collection: string, field: string) => field === "order";

const COLLECTION_AR: Record<string, string> = {
  "about.paragraphs": "فقرات النبذة", "about.stats": "أرقام النبذة", skills: "المهارات", "works.categories": "أقسام الأعمال", works: "الأعمال",
  process: "مراحل العمل", testimonials: "آراء العملاء", "contact.links": "روابط التواصل",
  "brief.projectTypes": "نموذج الطلب: نوع المشروع", "brief.footage": "نموذج الطلب: اللقطات", "brief.platforms": "نموذج الطلب: المنصة",
  "brief.durations": "نموذج الطلب: المدة", "brief.budgets": "نموذج الطلب: الميزانية", packages: "الباقات",
};
export const collectionLabel = (n: string) => COLLECTION_AR[n] ?? n;

const FIELD_AR: Record<string, string> = {
  title: "العنوان", desc: "الوصف", tag: "الوسم", video: "الفيديو", poster: "صورة الغلاف", category: "القسم", text: "النص", name: "الاسم", role: "الصفة",
  label: "العنوان", cta: "نص الزر", n: "الرقم", percent: "النسبة %", badge: "الرمز", value: "القيمة",
  price: "السعر", features: "الميزات (سطر لكل ميزة)",
};
export const fieldLabel = (name: string) => FIELD_AR[name] ?? name;

const TEXT_GROUP_AR: Record<string, string> = {
  hero: "الصفحة الرئيسية", about: "النبذة", skills: "المهارات", works: "الأعمال", process: "مراحل العمل", testimonials: "آراء العملاء", review: "نموذج الرأي",
  contact: "التواصل", brief: "نموذج الطلب", nav: "القائمة العلوية", meta: "عنوان الصفحة", splash: "الشاشة الأولى", footer: "أسفل الصفحة", brand: "الهوية", share: "المشاركة",
};
export const textGroup = (key: string) => TEXT_GROUP_AR[key.split(/[.[]/)[0]] ?? "أخرى";

const MEDIA_AR: Record<string, string> = {
  "brand.logo": "الشعار", "about.photo": "صورتك في النبذة", "contact.avatar": "صورتك في التواصل", "hero.poster": "صورة خلفية الصفحة الرئيسية", "hero.video": "فيديو خلفية الصفحة الرئيسية",
};
export const mediaLabel = (id: string) => MEDIA_AR[id] ?? id;

/** A readable name for an item (instead of its internal id). */
export function itemTitle(it: Item): string {
  for (const k of ["title", "name", "label", "text"]) { const v = it[k] as { ar?: unknown } | string | undefined; const s = typeof v === "string" ? v : typeof v?.ar === "string" ? v.ar : ""; if (s.trim()) return s.trim().slice(0, 60); }
  return String(it.id);
}

/** Turn a server/network error into one plain Arabic sentence. */
export function friendlyError(status: number | null, raw: string): string {
  if (status === null) return "تعذّر الاتصال بالسيرفر. تأكد أنه يعمل وأن الإنترنت متاح ثم أعد المحاولة.";
  if (status === 401 || status === 403) return "كلمة السر غير صحيحة.";
  if (status === 413) return "الملف أكبر من الحجم المسموح.";
  if (status === 415 || (status === 422 && /type|ext|format/i.test(raw))) return "نوع الملف غير مدعوم، أو الملف تالف.";
  if (status === 422) return "بعض البيانات غير صحيحة. راجع الحقول الملوّنة.";
  if (status === 429) return "محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.";
  if (status >= 500) return "حدث خطأ في السيرفر. أعد المحاولة بعد قليل.";
  return `تعذّر الحفظ (${status}).`;
}
