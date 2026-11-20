// STATUS: UNVERIFIED (Claude proposal). Field schemas inferred from the seed itself, so a new collection/field needs no admin code.
import { safeUrl, validEmail, validId, validWhatsapp, validateLText } from "./validate";

export type FieldKind = "ltext" | "text" | "url" | "number" | "email" | "whatsapp";
export interface Field { name: string; kind: FieldKind; nullable: boolean }
export type Item = { id: string } & Record<string, unknown>;

const URL_FIELDS = new Set(["video", "poster", "url"]);
const isL = (v: unknown) => !!v && typeof v === "object" && typeof (v as { ar?: unknown }).ar === "string";

export function inferFields(items: Item[]): Field[] {
  const names: string[] = []; for (const it of items) for (const k of Object.keys(it)) if (k !== "id" && !names.includes(k)) names.push(k);
  return names.map((name) => {
    const vals = items.map((i) => i[name]);
    const nullable = vals.some((v) => v === null || v === undefined);
    const sample = vals.find((v) => v !== null && v !== undefined);
    const kind: FieldKind = isL(sample) ? "ltext" : typeof sample === "number" ? "number" : URL_FIELDS.has(name) ? "url" : sample === undefined && name === "tag" ? "ltext" : typeof sample === "string" ? "text" : sample === undefined && URL_FIELDS.has(name) ? "url" : "text";
    return { name, kind, nullable };
  });
}
/** contact.links.value is an email, a phone or a URL depending on the link id. */
export const kindForItem = (collection: string, f: Field, item: Item): FieldKind =>
  collection === "contact.links" && f.name === "value" ? (item.id === "email" ? "email" : item.id === "whatsapp" ? "whatsapp" : "url") : f.kind;

export interface FieldError { field: string; message: string }
export function validateItem(collection: string, fields: Field[], item: Item): FieldError[] {
  const errs: FieldError[] = [];
  if (!validId(String(item.id ?? ""))) errs.push({ field: "id", message: "id: letters, digits, - _ (max 64)" });
  for (const f of fields) {
    const v = item[f.name], kind = kindForItem(collection, f, item);
    if (v === null || v === undefined || v === "") { if (!f.nullable && kind !== "ltext") errs.push({ field: f.name, message: "required" }); continue; }
    let m: string | null = null;
    if (kind === "ltext") m = validateLText(v);
    else if (kind === "number") m = typeof v === "number" && Number.isFinite(v) ? null : "must be a number";
    else if (typeof v !== "string") m = "must be text";
    else if (kind === "url") m = safeUrl(v) ? null : "unsafe or invalid URL";
    else if (kind === "email") m = validEmail(v) ? null : "invalid email";
    else if (kind === "whatsapp") m = validWhatsapp(v) ? null : "invalid phone number";
    if (m) errs.push({ field: f.name, message: m });
  }
  return errs;
}
export function blankItem(fields: Field[], id: string): Item {
  const it: Item = { id };
  for (const f of fields) it[f.name] = f.kind === "ltext" ? { ar: "" } : f.kind === "number" ? 0 : f.nullable ? null : "";
  return it;
}
