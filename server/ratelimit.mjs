// STATUS: UNVERIFIED (Claude, M11). In-memory fixed-window limiter. Resets on restart; one process only (documented in server/README.md).
export function createLimiter({ windowMs, max, now = Date.now }) {
  const hits = new Map(); // key -> { start, n }
  return {
    /** @returns {{ ok: boolean, retryAfter: number }} retryAfter in seconds */
    hit(key) {
      const t = now();
      if (hits.size > 10000) for (const [k, v] of hits) if (t - v.start >= windowMs) hits.delete(k);
      let e = hits.get(key);
      if (!e || t - e.start >= windowMs) { e = { start: t, n: 0 }; hits.set(key, e); }
      e.n++;
      return e.n <= max ? { ok: true, retryAfter: 0 } : { ok: false, retryAfter: Math.max(1, Math.ceil((e.start + windowMs - t) / 1000)) };
    },
    /** Count without consuming (for failed-auth gating). */
    blocked(key) {
      const e = hits.get(key);
      return !!e && now() - e.start < windowMs && e.n >= max;
    },
    size: () => hits.size,
  };
}
