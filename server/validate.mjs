// STATUS: UNVERIFIED (Claude, M11; sandbox tests only). Server-side validation: the browser validators (lib/admin/validate.ts,
// lib/contact.ts, lib/review.ts) are convenience only, so everything is checked again here. Parity with them is asserted in tests/server.test.ts.

const CTRL = /[\u0000- \u007f-\u009f]/g; // control chars and spaces are ignored by browsers inside a scheme ("java\nscript:")

/** http(s), mailto, tel, site-relative ("/x", not "//host"), "assets/x" and "#x". Everything else (javascript:, data:, vbscript:, file:) is refused. */
export function safeUrl(u) {
  if (typeof u !== "string") return false;
  const s = u.trim();
  if (!s || s.length > 2000) return false;
  const compact = s.replace(CTRL, "").toLowerCase();
  if (/^(https?:|mailto:|tel:)/.test(compact)) return true;
  if (/^[a-z][a-z0-9+.-]*:/.test(compact)) return false;
  return s.startsWith("/") ? !s.startsWith("//") && !s.startsWith("/\\") : /^(assets\/|#)/.test(s);
}
/** For media/video/poster fields: like safeUrl but never mailto:/tel:/#. */
export function safeMediaUrl(u) {
  if (!safeUrl(u)) return false;
  const c = u.trim().replace(CTRL, "").toLowerCase();
  return !/^(mailto:|tel:|#)/.test(c);
}

export const KEY_RE = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+|\[\d+\])*$/;
export const validKey = (k) => typeof k === "string" && k.length <= 120 && KEY_RE.test(k);
export const validId = (id) => typeof id === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id);
const validEmail = (s) => typeof s === "string" && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export function validateLText(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return "must be {ar,en?}";
  const extra = Object.keys(v).filter((k) => k !== "ar" && k !== "en");
  if (extra.length) return `unknown field: ${extra[0]}`;
  if (typeof v.ar !== "string") return "ar must be a string";
  if (v.en !== undefined && typeof v.en !== "string") return "en must be a string";
  if (v.ar.length > 5000 || (v.en?.length ?? 0) > 5000) return "too long (5000)";
  return null;
}

// ---- collections ----
export const COLLECTION_NAMES = [
  "about.paragraphs", "about.stats", "skills", "works.categories", "works", "process", "testimonials",
  "contact.links", "brief.projectTypes", "brief.footage", "brief.platforms", "brief.durations", "brief.budgets", "packages",
];
const L = "ltext", LN = "ltext?null", S = "str", N = "num", PCT = "pct", MURL = "murl", MURLN = "murl?null";
const OPT = (t) => `opt:${t}`;
const BRIEF = { value: S, label: L };
const SPEC = {
  "about.paragraphs": { text: L },
  "about.stats": { n: S, label: L },
  skills: { name: S, percent: PCT, badge: OPT(S), icon: OPT(S) },
  "works.categories": { label: L, cta: L },
  works: { category: S, order: N, title: L, desc: L, tag: LN, video: MURL, poster: MURLN },
  process: { title: L, text: L },
  testimonials: { text: L, name: L, role: L },
  "contact.links": { value: S },
  "brief.projectTypes": BRIEF, "brief.footage": BRIEF, "brief.platforms": BRIEF, "brief.durations": BRIEF, "brief.budgets": BRIEF,
  "packages": { name: L, price: L, features: L },
};
const CONTACT_IDS = ["email", "whatsapp", "instagram", "facebook"];
const BAD_SCHEME = /^(javascript:|data:|vbscript:|file:)/;

function checkField(kind, v) {
  if (kind.startsWith("opt:")) return v === undefined ? null : checkField(kind.slice(4), v);
  switch (kind) {
    case L: return validateLText(v);
    case LN: return v === null ? null : validateLText(v);
    case S: return typeof v === "string" ? (v.length <= 2000 ? null : "too long (2000)") : "must be a string";
    case N: return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1e6 ? null : "must be a non-negative number";
    case PCT: return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100 ? null : "must be a number 0-100";
    case MURL: return safeMediaUrl(v) ? null : "unsafe or invalid url";
    case MURLN: return v === null || safeMediaUrl(v) ? null : "unsafe or invalid url";
    default: return "bad spec";
  }
}

/** Returns an error string or null. `id` is the id from the URL. */
export function validateItem(name, item, id) {
  const spec = SPEC[name];
  if (!spec) return `unknown collection: ${name}`;
  if (!item || typeof item !== "object" || Array.isArray(item)) return "item must be an object";
  if (item.id !== id) return "item.id must equal the id in the URL";
  if (name === "contact.links") {
    if (!CONTACT_IDS.includes(id)) return `contact.links id must be one of ${CONTACT_IDS.join(", ")}`;
  } else {
    if (!validId(id)) return "invalid id";
    if (id === "order") return 'the id "order" is reserved';
  }
  const allowed = new Set(["id", ...Object.keys(spec)]);
  for (const k of Object.keys(item)) if (!allowed.has(k)) return `unknown field: ${k}`;
  for (const [field, kind] of Object.entries(spec)) {
    const e = checkField(kind, item[field]);
    if (e) return `${field}: ${e}`;
    if (item[field] === undefined && !kind.startsWith("opt:")) return `${field}: required`;
  }
  if (name === "contact.links") {
    const v = item.value.trim();
    if (v.length > 300) return "value: too long (300)";
    if (id === "email" && !validEmail(v)) return "value: invalid email";
    if (id === "whatsapp" && !/^\+?[\d٠-٩۰-۹\s-]{6,20}$/.test(v)) return "value: invalid number";
    if ((id === "instagram" || id === "facebook") && BAD_SCHEME.test(v.replace(CTRL, "").toLowerCase())) return "value: unsafe";
    if ((id === "instagram" || id === "facebook") && /^[a-z][a-z0-9+.-]*:/i.test(v) && !safeUrl(v)) return "value: unsafe";
  }
  return null;
}

export function validateMedia(slot, id) {
  if (!validKey(id)) return "invalid media key";
  if (!slot || typeof slot !== "object" || Array.isArray(slot)) return "must be an object";
  if (slot.id !== id) return "slot.id must equal the id in the URL";
  for (const k of Object.keys(slot)) if (!["id", "url", "type", "alt"].includes(k)) return `unknown field: ${k}`;
  if (slot.type !== "image" && slot.type !== "video") return "type must be image or video";
  if (!safeMediaUrl(slot.url)) return "url: unsafe or invalid";
  if (slot.alt !== undefined && (typeof slot.alt !== "string" || slot.alt.length > 300)) return "alt: must be a string up to 300";
  return null;
}

// ---- public forms ----
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max + 1) : "");
/** Returns { error } or { value }. A non-empty honeypot (`website`) is an error (contract). */
export function validateReview(b) {
  if (!b || typeof b !== "object") return { error: "invalid body" };
  if (typeof b.website === "string" && b.website.trim() !== "") return { error: "rejected" };
  const name = str(b.name, 80), role = str(b.role, 80), text = str(b.text, 500);
  if (name.length < 2 || name.length > 80) return { error: "name: 2-80 characters" };
  if (role.length > 80) return { error: "role: up to 80 characters" };
  if (text.length < 10 || text.length > 500) return { error: "text: 10-500 characters" };
  return { value: { name, role, text } };
}
export function validateContact(b) {
  if (!b || typeof b !== "object") return { error: "invalid body" };
  if (typeof b.website === "string" && b.website.trim() !== "") return { error: "rejected" };
  const name = str(b.name, 80), email = str(b.email, 254), msg = str(b.msg, 2000);
  if (name.length < 2 || name.length > 80) return { error: "name: 2-80 characters" };
  if (!validEmail(email)) return { error: "email: invalid" };
  if (msg.length < 10 || msg.length > 2000) return { error: "msg: 10-2000 characters" };
  return { value: { name, email, msg } };
}
