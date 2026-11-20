// STATUS: UNVERIFIED (Claude proposal; not type-checked against real @types/react / next)
"use client";
import { useEffect, useRef } from "react";
import { mountScrollProgress, type ProgressEnv } from "@/lib/scroll-progress";

/** `#scrollProgress` bar (CSS in app/enhancements.css). Put once in the page, e.g. just before <Effects/>. */
export default function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = ref.current; if (!bar) return;
    return mountScrollProgress({ win: window, doc: document, requestAnimationFrame: (f: () => void) => window.requestAnimationFrame(f) } as unknown as ProgressEnv, bar);
  }, []);
  return <div id="scrollProgress" aria-hidden="true" ref={ref} />;
}
