// STATUS: UNVERIFIED (Claude proposal). Port of the v4 cursor/touch follower (index.html 2151-2237), parity-tested against that code verbatim.
export interface CursorEl { style: { opacity: string; transform: string; width: string; height: string } }
export interface CursorEnv {
  win: { innerWidth: number; innerHeight: number; addEventListener(t: string, f: (e: any) => void, o?: any): void; removeEventListener(t: string, f: (e: any) => void): void };
  raf(f: () => void): number; caf(id: number): void;
  setTimeout(f: () => void, ms: number): number; clearTimeout(id: number): void;
  interactive: { addEventListener(t: string, f: () => void): void; removeEventListener(t: string, f: () => void): void }[];
  spawnRipple(x: number, y: number): void;
}
/** One animation step: dot is faster on x than y (0.14/0.35), ring slower (0.07/0.12); v4 constants. */
export function stepFollower(s: { mx: number; my: number; dx: number; dy: number; rx: number; ry: number }) {
  const dotClose = Math.abs(s.mx - s.dx) < 0.1 && Math.abs(s.my - s.dy) < 0.1;
  const ringClose = Math.abs(s.mx - s.rx) < 0.1 && Math.abs(s.my - s.ry) < 0.1;
  if (dotClose && ringClose) return null;
  return { ...s, dx: s.dx + (s.mx - s.dx) * 0.14, dy: s.dy + (s.my - s.dy) * 0.35, rx: s.rx + (s.mx - s.rx) * 0.07, ry: s.ry + (s.my - s.ry) * 0.12 };
}

/** Returns a teardown. Caller skips this when prefers-reduced-motion (v4: reduceMotion). */
export function mountCursor(env: CursorEnv, dot: CursorEl, ring: CursorEl): () => void {
  const w = env.win;
  let s = { mx: w.innerWidth / 2, my: w.innerHeight / 2, dx: w.innerWidth / 2, dy: w.innerHeight / 2, rx: w.innerWidth / 2, ry: w.innerHeight / 2 };
  let active = false, hideTimer: number | undefined, raf: number | null = null;
  const anim = () => {
    const n = stepFollower(s);
    if (n) {
      s = n;
      dot.style.transform = `translate(${s.dx}px, ${s.dy}px) translate(-50%,-50%)`;
      ring.style.transform = `translate(${s.rx}px, ${s.ry}px) translate(-50%,-50%)`;
      raf = env.raf(anim);
    } else raf = null;
  };
  const ensure = () => { if (raf === null) raf = env.raf(anim); };
  const show = () => { ensure(); if (hideTimer !== undefined) env.clearTimeout(hideTimer); if (!active) { active = true; dot.style.opacity = "1"; ring.style.opacity = "0.55"; } };
  const hide = () => { hideTimer = env.setTimeout(() => { dot.style.opacity = "0"; ring.style.opacity = "0"; active = false; }, 500); };
  const onMove = (e: { clientX: number; clientY: number }) => { s.mx = e.clientX; s.my = e.clientY; show(); };
  const onTouch = (ripple: boolean) => (e: { touches: ArrayLike<{ clientX: number; clientY: number }> }) => {
    const t = e.touches[0]; if (!t) return; s.mx = t.clientX; s.my = t.clientY; show(); if (ripple) env.spawnRipple(s.mx, s.my);
  };
  const onStart = onTouch(true), onTMove = onTouch(false);
  w.addEventListener("mousemove", onMove); w.addEventListener("touchstart", onStart, { passive: true }); w.addEventListener("touchmove", onTMove, { passive: true });
  w.addEventListener("touchend", hide, { passive: true }); w.addEventListener("touchcancel", hide, { passive: true });
  ensure();
  const enter = () => { ring.style.width = "48px"; ring.style.height = "48px"; ring.style.opacity = "0.85"; };
  const leave = () => { ring.style.width = "34px"; ring.style.height = "34px"; ring.style.opacity = "0.55"; };
  env.interactive.forEach((el) => { el.addEventListener("mouseenter", enter); el.addEventListener("mouseleave", leave); });
  return () => {
    w.removeEventListener("mousemove", onMove); w.removeEventListener("touchstart", onStart); w.removeEventListener("touchmove", onTMove);
    w.removeEventListener("touchend", hide); w.removeEventListener("touchcancel", hide);
    env.interactive.forEach((el) => { el.removeEventListener("mouseenter", enter); el.removeEventListener("mouseleave", leave); });
    if (raf !== null) env.caf(raf); if (hideTimer !== undefined) env.clearTimeout(hideTimer);
    dot.style.opacity = "0"; ring.style.opacity = "0";
  };
}
