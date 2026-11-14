import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as S from "../lib/spotlight";

/* Runs the ORIGINAL v4 testimonials code (tests/fixtures/spotlight-original.js, copied verbatim from
   index.html) against a fake DOM and compares everything it writes with lib/spotlight.ts. */
const ORIGINAL = readFileSync(new URL("./fixtures/spotlight-original.js", import.meta.url), "utf8");

type Style = { transform: string; opacity: string | number; zIndex: number | string; filter: string };
function harness(opts: { mobile: boolean; n: number; rect?: { top: number; height: number }; innerWidth?: number; innerHeight?: number }) {
  const w = { top: 0, height: 3000, ...opts.rect };
  const innerWidth = opts.innerWidth ?? 1200, innerHeight = opts.innerHeight ?? 800;
  const cards = Array.from({ length: opts.n }, () => ({ style: {} as Style }));
  const dots: { cls: boolean; handlers: Record<string, () => void>; classList: any; className?: string; setAttribute(): void; addEventListener(t: string, f: () => void): void }[] = [];
  const dotsBox = { appendChild(d: any) { dots.push(d); }, get children() { return dots; } };
  const touch: Record<string, (e: any) => void> = {};
  const winL: Record<string, () => void> = {};
  const rafQ: Array<() => void> = [];
  const intervals: Array<() => void> = [];
  const scrolls: any[] = [];
  const doc = {
    getElementById: (id: string) => id === "testimonialsScroll" ? { getBoundingClientRect: () => ({ top: w.top, height: w.height }) }
      : id === "spotlightTrack" ? { querySelectorAll: () => cards, parentElement: { addEventListener: (t: string, f: any) => { touch[t] = f; } } }
      : dotsBox,
    createElement: () => { const d: any = { active: false, handlers: {}, setAttribute() {}, addEventListener(t: string, f: () => void) { d.handlers[t] = f; }, classList: { toggle(_: string, v: boolean) { d.active = v; } } }; return d; },
  };
  const mqL: Array<() => void> = [];
  const win: any = {
    innerWidth, innerHeight, scrollY: 0,
    matchMedia: (q: string) => ({ matches: q.includes("reduced-motion") ? false : opts.mobile, addEventListener: (_: string, f: () => void) => mqL.push(f) }),
    addEventListener: (t: string, f: () => void) => { winL[t] = f; }, removeEventListener: () => {},
    scrollTo: (a: any) => scrolls.push(a),
  };
  vm.runInNewContext(`(function(){${ORIGINAL}})()`, {
    document: doc, window: win, requestAnimationFrame: (f: () => void) => { rafQ.push(f); }, setInterval: (f: () => void) => { intervals.push(f); return 1; }, clearInterval() {}, setTimeout: () => 0, Array, Math, Number, String,
  });
  return {
    cards, dots, touch, scrolls, winL,
    activeDot: () => dots.findIndex((d: any) => d.active),
    flush: () => { while (rafQ.length) rafQ.shift()!(); },
    tick: () => intervals[0]?.(),
    setRect(top: number) { w.top = top; },
  };
}
const norm = (s: Style) => ({ transform: s.transform, opacity: String(s.opacity), zIndex: Number(s.zIndex), filter: s.filter });

test("desktop: every card style and active dot match the original for many scroll positions", () => {
  for (const n of [1, 2, 4, 6]) for (const innerWidth of [1200, 900]) {
    const h = harness({ mobile: false, n, innerWidth });
    for (const top of [200, 0, -50, -176, -500, -1100, -1600, -2000, -2200, -2400]) {
      h.setRect(top); h.winL.scroll(); h.flush();
      const af = S.desktopActiveFloat(top, 3000, 800, n)!;
      const gap = S.desktopGap(innerWidth);
      h.cards.forEach((c, i) => assert.deepEqual(norm(c.style), S.desktopCardStyle(i, af, gap), `n=${n} w=${innerWidth} top=${top} card=${i}`));
      assert.equal(h.activeDot(), S.desktopNearest(af), `dot n=${n} top=${top}`);
    }
  }
});

test("desktop: no rendering when the section is not taller than the viewport", () => {
  assert.equal(S.desktopActiveFloat(0, 800, 800, 4), null);
  assert.equal(S.desktopActiveFloat(0, 500, 800, 4), null);
  assert.equal(S.desktopScrollTarget(1, 4, 100, 0), null);
});

test("desktop: dot click scroll target matches the original", () => {
  const h = harness({ mobile: false, n: 4 });
  h.dots.forEach((d: any, i) => {
    h.scrolls.length = 0; d.handlers.click();
    assert.equal(h.scrolls[0].top, S.desktopScrollTarget(i, 4, 0 + 0, 3000 - 800));
  });
});

test("mobile: initial render, autoplay ticks, swipes and dot clicks match the original", () => {
  for (const n of [2, 4, 5, 6]) {
    const h = harness({ mobile: true, n });
    let idx = 0;
    const check = (label: string) => {
      h.cards.forEach((c, i) => assert.deepEqual(norm(c.style), S.mobileCardStyle(i, idx, n), `${label} n=${n} card=${i}`));
      assert.equal(h.activeDot(), S.mobileActiveDot(idx, n), `${label} dot`);
    };
    check("init");
    for (let k = 0; k < n + 2; k++) { h.tick(); idx = S.mobileNext(idx, n); check(`tick${k}`); }
    for (const dx of [41, -41, 40, -40, 120, -300, 0]) {
      h.touch.touchstart({ touches: [{ clientX: 0 }] }); h.touch.touchend({ changedTouches: [{ clientX: dx }] });
      idx = S.mobileSwipe(idx, dx, n); check(`swipe${dx}`);
    }
    h.dots.forEach((d: any, i) => { d.handlers.click(); idx = i; check(`dot${i}`); });
  }
});

test("constants and helpers", () => {
  assert.equal(S.MOBILE_QUERY, "(max-width: 720px)");
  assert.equal(S.MOBILE_AUTOPLAY_MS, 4500);
  assert.equal(S.desktopGap(1000), 260);
  assert.equal(S.desktopGap(1001), 290);
  assert.equal(S.mobileSwipe(0, 41, 4), 1);
  assert.equal(S.mobileSwipe(0, -41, 4), 3);
  assert.equal(S.mobileSwipe(2, 40, 4), 2);
});
