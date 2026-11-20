// STATUS: UNVERIFIED (Claude proposal). Where the Python server lives. Unset => no direct sending (honest fallback, never a silent success).
export const API_BASE: string | null = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) || null;
export const apiUrl = (base: string, path: string) => base.replace(/\/$/, "") + path;
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
