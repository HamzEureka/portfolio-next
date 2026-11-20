// STATUS: UNVERIFIED (Claude proposal). Writes are DISABLED unless NEXT_PUBLIC_ADMIN_API is set (the server is out of scope).
export const ADMIN_API_BASE: string | null = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_ADMIN_API) || null;
export const TOKEN_KEY = "admin-token";
export function readToken(): string | null { try { return window.sessionStorage.getItem(TOKEN_KEY); } catch { return null; } }
export function saveToken(t: string): void { try { window.sessionStorage.setItem(TOKEN_KEY, t); } catch { /* blocked */ } }
