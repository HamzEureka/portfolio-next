"use client";
import { useEffect } from "react";

/** Ported from the v4 inline script: nav toggle, waveform bars, scroll reveal, skill counters.
 *  (Cursor follower, stack playback, explosion, testimonials motion, theme come in later stages.) */
export default function Effects() {
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    const toggle = document.getElementById("navToggle"), links = document.getElementById("navLinks");
    if (toggle && links) {
      const onToggle = () => links.classList.toggle("open");
      const close = () => links.classList.remove("open");
      toggle.addEventListener("click", onToggle);
      links.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
      cleanups.push(() => { toggle.removeEventListener("click", onToggle); links.querySelectorAll("a").forEach((a) => a.removeEventListener("click", close)); });
    }

    const wf = document.querySelector(".waveform");
    if (wf && !wf.childElementCount) {
      let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      for (let i = 0; i < 46; i++) { const b = document.createElement("span"); b.style.height = 4 + rnd() * 18 + "px"; wf.appendChild(b); }
    }

    const reveal = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if ("IntersectionObserver" in window && reveal.length) {
      const io = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target as HTMLElement;
        setTimeout(() => el.classList.add("in-view"), Number(el.dataset.revealIndex || 0) * 90);
        io.unobserve(el);
      }), { threshold: 0.15, rootMargin: "0px 0px -60px 0px" });
      let last: Element | null = null, idx = 0;
      reveal.forEach((el) => { if (el.parentElement !== last) { last = el.parentElement; idx = 0; } el.dataset.revealIndex = String(idx++); io.observe(el); });
      cleanups.push(() => io.disconnect());
    } else reveal.forEach((el) => el.classList.add("in-view"));

    const skills = document.querySelectorAll<HTMLElement>(".tool-skill");
    if ("IntersectionObserver" in window && skills.length) {
      const so = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target as HTMLElement, target = parseInt(el.dataset.percent || "0", 10) || 0;
        const bar = el.querySelector<HTMLElement>(".meter i"), label = el.querySelector<HTMLElement>(".tool-percent");
        if (bar) bar.style.width = target + "%";
        if (label) {
          const start = performance.now();
          const tick = (now: number) => { const p = Math.min((now - start) / 1400, 1); label.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target) + "%"; if (p < 1) requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
        }
        so.unobserve(el);
      }), { threshold: 0.4 });
      skills.forEach((el) => so.observe(el));
      cleanups.push(() => so.disconnect());
    }
    return () => cleanups.forEach((f) => f());
  }, []);
  return null;
}
