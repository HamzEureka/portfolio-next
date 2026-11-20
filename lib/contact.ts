// STATUS: UNVERIFIED (Claude proposal). v4 contact form has NO submit handler at all (gap). Owner decision: send to the server over HTTP.
// Contract (to be built server-side, see docs): POST {API_BASE}/contact {name,email,msg,website} -> 2xx ok | 422 invalid | 429 rate limited.
import { apiUrl, type FetchLike } from "./api-base";
export interface ContactPayload { name: string; email: string; msg: string; website: string }
export type ContactError = "name" | "email" | "msg" | null;
export const validEmailLoose = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export function validateContact(p: ContactPayload): ContactError {
  if (p.name.length < 2) return "name";
  if (!validEmailLoose(p.email)) return "email";
  if (p.msg.length < 10) return "msg";
  return null;
}
export type ContactOutcome = "done" | "invalid" | "limited" | "unavailable";
export async function submitContact(f: FetchLike, base: string | null, p: ContactPayload): Promise<ContactOutcome> {
  if (!base) return "unavailable";
  try {
    const r = await f(apiUrl(base, "/contact"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    if (r.ok) return "done"; if (r.status === 422) return "invalid"; if (r.status === 429) return "limited";
  } catch { /* offline */ }
  return "unavailable";
}
