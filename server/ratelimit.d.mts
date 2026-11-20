export function createLimiter(o: { windowMs: number; max: number; now?: () => number }): { hit(key: string): { ok: boolean; retryAfter: number }; blocked(key: string): boolean; size(): number };
