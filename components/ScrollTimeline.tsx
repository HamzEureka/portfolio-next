"use client";
import { useEffect, useRef } from "react";

// Fixed bottom bar styled like an editing timeline: one clip per section, a playhead that follows the scroll and a timecode.
export interface TimelineItem { id: string; label: string }
const pad = (n: number) => (n < 10 ? "0" : "") + n;
const tc = (sec: number) => `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec / 60) % 60)}:${pad(Math.floor(sec) % 60)}:${pad(Math.floor((sec % 1) * 24))}`;

export default function ScrollTimeline({ items, label }: { items: TimelineItem[]; label: string }) {
  const track = useRef<HTMLDivElement>(null), head = useRef<HTMLElement>(null), code = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const tr = track.current, ph = head.current, tcv = code.current; if (!tr || !ph || !tcv) return;
    const clips = Array.from(tr.querySelectorAll<HTMLAnchorElement>("a.clip"));
    const secs = clips.map((c) => document.getElementById(c.dataset.s ?? ""));
    let queued = 0;
    const weights = () => secs.forEach((s, i) => { clips[i].style.flexGrow = String(Math.max(1, Math.round(s?.offsetHeight ?? 1))); });
    const update = () => {
      queued = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight, p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      ph.style.transform = `translate3d(${p * tr.clientWidth}px,0,0)`; tcv.textContent = tc(p * 48);
      const mid = window.scrollY + window.innerHeight * 0.4;
      clips.forEach((c, i) => { const s = secs[i]; if (!s) return; const top = s.getBoundingClientRect().top + window.scrollY; c.classList.toggle("on", mid >= top && mid < top + s.offsetHeight); });
    };
    const onScroll = () => { if (!queued) queued = requestAnimationFrame(update); };
    const onResize = () => { weights(); update(); };
    window.addEventListener("scroll", onScroll, { passive: true }); window.addEventListener("resize", onResize); window.addEventListener("load", onResize);
    weights(); update();
    return () => { cancelAnimationFrame(queued); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onResize); window.removeEventListener("load", onResize); };
  }, [items]);
  return (
    <nav className="tl" aria-label={label}>
      <span ref={code} className="tcv">00:00:00:00</span>
      <div ref={track} className="tr">
        {items.map((x) => <a key={x.id} className="clip" href={`#${x.id}`} data-s={x.id}>{x.label}</a>)}
        <i ref={head as React.RefObject<HTMLElement>} className="ph" />
      </div>
    </nav>
  );
}
