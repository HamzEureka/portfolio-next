// STATUS: UNVERIFIED (Claude proposal). Ported from v4 js/enhancements.js (heroMedia); parity tests: tests/v9-hero.test.ts
import type { ElLike, HeroEnv, IOLike, VideoLike } from "./enh-contract";

export type HeroMode = "poster-only" | "kb" | "video";

/** Decision table of v4: reduced motion -> poster only (no zoom); small screen or slow/save-data connection -> poster + slow zoom (`kb`); else video. */
export function heroMediaPlan(p: { reduce: boolean; small: boolean; saveData?: boolean; effectiveType?: string }): HeroMode {
  if (p.reduce) return "poster-only";
  const slow = !!p.saveData || /(^|-)2g$/.test(p.effectiveType || "");
  return p.small || slow ? "kb" : "video";
}

const h = (doc: HeroEnv["doc"], tag: string, attrs: Record<string, string>): ElLike => {
  const e = doc.createElement(tag); for (const k of Object.keys(attrs)) e.setAttribute(k, attrs[k]); return e;
};

/** Adds `.hero-bg-media` (poster, optional looping video) as the first child of `hero`. Returns a teardown that removes it (v4 had none). */
export function mountHeroMedia(env: HeroEnv, hero: ElLike, poster: string, video: string): () => void {
  const wrap = h(env.doc, "div", { class: "hero-bg-media", "aria-hidden": "true" });
  const img = h(env.doc, "img", { class: "hero-bg-poster", alt: "", src: poster, decoding: "async" });
  wrap.append(img); hero.prepend(wrap);
  img.addEventListener("load", () => wrap.classList.add("on"));
  img.addEventListener("error", () => wrap.remove());

  let io: IOLike | null = null;
  const done = () => { io?.disconnect(); wrap.remove(); };

  const c = env.navigator.connection || {};
  const mode = heroMediaPlan({
    reduce: env.matchMedia("(prefers-reduced-motion: reduce)").matches,
    small: env.matchMedia("(max-width: 720px)").matches,
    saveData: c.saveData, effectiveType: c.effectiveType,
  });
  if (mode === "poster-only") return done;
  if (mode === "kb") { wrap.classList.add("kb"); return done; }

  const v = h(env.doc, "video", { class: "hero-bg-video", loop: "", playsinline: "", preload: "none", poster }) as VideoLike;
  v.muted = true;
  v.append(h(env.doc, "source", { src: video, type: "video/mp4" })); wrap.append(v);
  v.addEventListener("canplay", () => v.classList.add("ready"));
  v.addEventListener("error", () => { v.remove(); wrap.classList.add("kb"); }, true);
  v.play().catch(() => wrap.classList.add("kb"));
  if (env.IntersectionObserver) {                                   // pause when off-screen
    io = new env.IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) v.play().catch(() => {}); else v.pause(); }));
    io.observe(hero);
  }
  return done;
}
