// STATUS: UNVERIFIED (Claude proposal; not type-checked against real @types/react / next)
"use client";
import { useEffect } from "react";
import { mountHeroMedia } from "@/lib/hero-media";
import type { ElLike, HeroEnv } from "@/lib/enh-contract";

/** Renders nothing; like v4 it prepends `.hero-bg-media` into the (server-rendered) `.hero` section, so React never reconciles those nodes.
 *  Props = media slots hero.poster / hero.video (the files are 0 bytes today: the poster `error` handler then removes the wrapper, as in v4). */
export default function HeroBackground({ poster, video }: { poster: string; video: string }) {
  useEffect(() => {
    const hero = document.querySelector(".hero"); if (!hero || !poster) return;
    const env = { doc: document, matchMedia: (q: string) => window.matchMedia(q), navigator, IntersectionObserver: "IntersectionObserver" in window ? window.IntersectionObserver : undefined } as unknown as HeroEnv;
    return mountHeroMedia(env, hero as unknown as ElLike, poster, video);
  }, [poster, video]);
  return null;
}
