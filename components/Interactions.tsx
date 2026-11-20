// STATUS: UNVERIFIED (Claude proposal; not type-checked against real @types/react). Cursor follower + share button on the existing server-rendered markup (#cursorDot, #cursorRing, #shareBtn). Renders nothing.
"use client";
import { useEffect } from "react";
import { mountCursor, type CursorEnv, type CursorEl } from "@/lib/cursor";
import { shareSite } from "@/lib/share";

export default function Interactions({ t }: { t: Record<string, string> }) {
  useEffect(() => {
    const offs: (() => void)[] = [];
    const dot = document.getElementById("cursorDot"), ring = document.getElementById("cursorRing");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;     // v4: reduceMotion disables the follower
    if (dot && ring && !reduce) {
      const env: CursorEnv = {
        win: window as unknown as CursorEnv["win"],
        raf: (f) => window.requestAnimationFrame(f), caf: (id) => window.cancelAnimationFrame(id),
        setTimeout: (f, ms) => window.setTimeout(f, ms), clearTimeout: (id) => window.clearTimeout(id),
        interactive: Array.from(document.querySelectorAll("a, button, input, textarea, select, video")),
        spawnRipple: (x, y) => { const r = document.createElement("div"); r.className = "tap-ripple"; r.style.left = x + "px"; r.style.top = y + "px"; document.body.appendChild(r); r.addEventListener("animationend", () => r.remove()); },
      };
      offs.push(mountCursor(env, dot as unknown as CursorEl, ring as unknown as CursorEl));
    }
    const btn = document.getElementById("shareBtn");
    if (btn) {
      let timer = 0;
      const onClick = async () => {
        const label = btn.querySelector("span:last-child"); if (!label) return;
        const old = label.textContent ?? "";
        const flash = (s: string) => { label.textContent = s; window.clearTimeout(timer); timer = window.setTimeout(() => { label.textContent = old; }, 1800); };
        const r = await shareSite({ share: navigator.share ? (d) => navigator.share(d) : undefined, writeText: navigator.clipboard ? (s) => navigator.clipboard.writeText(s) : undefined },
          { title: document.title, text: t["share.text"], url: location.href });
        if (r === "copied") flash(t["share.copied"]); else if (r === "manual") flash(t["share.manual"]);
      };
      btn.addEventListener("click", onClick);
      offs.push(() => { btn.removeEventListener("click", onClick); window.clearTimeout(timer); });
    }
    return () => offs.forEach((f) => f());
  }, [t]);
  return null;
}
