// STATUS: UNVERIFIED (Claude proposal). v10 decision: the brief stays a dialog (no /brief page); the WhatsApp message follows the UI language.
import type { Lang } from "./content/types";
import { BRIEF_LABELS_AR, composeBriefRequest, type BriefLabels, type BriefRaw, type BriefRequest } from "./brief";

export const BRIEF_LABELS_EN: BriefLabels = {
  title: "New quote request", name: "Name: ", whatsapp: "WhatsApp: ", ptype: "Project type: ", duration: "Video length: ",
  count: "Number of videos: ", footage: "Raw footage: ", platforms: "Platforms: ", ref: "Visual reference: ",
  deadline: "Requested delivery date: ", budget: "Approximate budget: ", notes: "Additional details: ", platformsSeparator: ", ",
};
export const briefLabels = (lang: Lang): BriefLabels => (lang === "en" ? BRIEF_LABELS_EN : BRIEF_LABELS_AR);

/** Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits -> 0-9. */
export const toAsciiDigits = (s: string): string =>
  s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));

/** composeBriefRequest + language labels + digit fix for the configured wa.me number (v4 dropped Arabic-Indic digits, giving a wrong link).
 *  The number is the OWNER's (contact.links), so this only matters if it was typed with Arabic digits in the admin. */
export function composeBrief(raw: BriefRaw, waNumber: string, lang: Lang): BriefRequest {
  return composeBriefRequest(raw, toAsciiDigits(waNumber), briefLabels(lang));
}
