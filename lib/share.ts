// STATUS: UNVERIFIED (Claude proposal). v4 share button: navigator.share, else clipboard, else "copy it yourself". Pure; DOM wiring in Interactions.tsx.
export type ShareResult = "shared" | "cancelled" | "copied" | "manual";
export interface ShareEnv {
  share?: (d: { title: string; text: string; url: string }) => Promise<void>;
  writeText?: (s: string) => Promise<void>;
}
export async function shareSite(env: ShareEnv, data: { title: string; text: string; url: string }): Promise<ShareResult> {
  if (env.share) { try { await env.share(data); return "shared"; } catch { return "cancelled"; } }   // v4: cancel is silent
  try { if (!env.writeText) throw new Error("no clipboard"); await env.writeText(data.url); return "copied"; } catch { return "manual"; }
}
