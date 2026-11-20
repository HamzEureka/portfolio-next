import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { shareSite } from "../lib/share";
import { validateReview, submitReview, reviewWhatsappHref, reviewCount } from "../lib/review";
import { validateContact, submitContact } from "../lib/contact";
import { mountCursor, stepFollower } from "../lib/cursor";

const D = { title: "T", text: "X", url: "https://s.test/" };
test("share: native, cancelled, clipboard, manual (v4 order)", async () => {
  assert.equal(await shareSite({ share: async () => {}, writeText: async () => { throw 1; } }, D), "shared");
  assert.equal(await shareSite({ share: async () => { throw new Error("AbortError"); } }, D), "cancelled");
  let copied = ""; assert.equal(await shareSite({ writeText: async (s) => { copied = s; } }, D), "copied"); assert.equal(copied, D.url);
  assert.equal(await shareSite({ writeText: async () => { throw 1; } }, D), "manual");
  assert.equal(await shareSite({}, D), "manual");
});

const P = { name: "علي", role: "", text: "شغل ممتاز جدا", website: "" };
test("review: validation thresholds equal v4 (name>=2, text>=10, name checked first)", () => {
  assert.equal(validateReview({ ...P, name: "ع" }), "name"); assert.equal(validateReview({ ...P, text: "123456789" }), "text");
  assert.equal(validateReview({ ...P, name: "", text: "" }), "name"); assert.equal(validateReview(P), null); assert.equal(reviewCount(7), "7 / 500");
});
test("review: server outcome mapping equals v4", async () => {
  const mk = (status: number, body: unknown = {}, ok = status < 300) => async () => ({ ok, status, json: async () => body });
  assert.deepEqual(await submitReview(mk(200), "https://s", P), { kind: "done" });
  assert.deepEqual(await submitReview(mk(429, { detail: "wait" }), "https://s", P), { kind: "problem", status: 429, detail: "wait" });
  assert.deepEqual(await submitReview(mk(429, { detail: 5 }), "https://s", P), { kind: "problem", status: 429, detail: undefined });
  assert.deepEqual(await submitReview(mk(422), "https://s", P), { kind: "problem", status: 422 });
  assert.deepEqual(await submitReview(mk(500), "https://s", P), { kind: "fallback" });
  assert.deepEqual(await submitReview((async () => { throw new Error("net"); }) as never, "https://s", P), { kind: "fallback" });
  assert.deepEqual(await submitReview(mk(200), null, P), { kind: "fallback" });
});
test("review: WhatsApp text: ar identical to the v4 expression; en follows UI language", () => {
  const p = { ...P, role: "صاحب متجر" };
  const v4 = "https://wa.me/" + "+963 98".replace(/\D/g, "") + "?text=" + encodeURIComponent("رأي جديد\nالاسم: " + p.name + (p.role ? "\nالصفة: " + p.role : "") + "\nالرأي: " + p.text);
  assert.equal(reviewWhatsappHref("+963 98", p, "ar"), v4);
  assert.equal(reviewWhatsappHref("1", P, "en"), "https://wa.me/1?text=" + encodeURIComponent("New review\nName: علي\nReview: شغل ممتاز جدا"));
});
test("contact: validation and outcomes", async () => {
  const C = { name: "Ali", email: "a@b.co", msg: "0123456789", website: "" };
  assert.equal(validateContact(C), null); assert.equal(validateContact({ ...C, name: "A" }), "name"); assert.equal(validateContact({ ...C, email: "x" }), "email"); assert.equal(validateContact({ ...C, msg: "short" }), "msg");
  const seen: any[] = [];
  const mk = (status: number) => async (u: string, i: any) => { seen.push([u, i.method, i.body]); return { ok: status < 300, status, json: async () => ({}) }; };
  assert.equal(await submitContact(mk(200), "https://s/api/", C), "done"); assert.equal(seen[0][0], "https://s/api/contact"); assert.equal(seen[0][1], "POST");
  assert.equal(await submitContact(mk(422), "https://s", C), "invalid"); assert.equal(await submitContact(mk(429), "https://s", C), "limited");
  assert.equal(await submitContact(mk(500), "https://s", C), "unavailable"); assert.equal(await submitContact(mk(200), null, C), "unavailable");
});

// ---- cursor parity: v4 code (verbatim fixture) vs port, same event script ----
const FIX = readFileSync(new URL("./fixtures/cursor-original.js", import.meta.url), "utf8");
test("cursor fixture is v4 verbatim", () => { assert.equal(createHash("sha256").update(FIX).digest("hex").slice(0, 12), "d2faf4036ef2"); });

function fakeWorld() {
  const q: (() => void)[] = []; const timers: { f: () => void; ms: number; id: number; live: boolean }[] = []; let tid = 0;
  const handlers: Record<string, ((e: any) => void)[]> = {};
  const mkEl = () => { const h: Record<string, (() => void)[]> = {}; return { style: { opacity: "", transform: "", width: "", height: "", left: "", top: "" } as any, className: "", h, addEventListener(t: string, f: () => void) { (h[t] ??= []).push(f); }, removeEventListener(t: string, f: () => void) { h[t] = (h[t] ?? []).filter((x) => x !== f); }, remove() {}, }; };
  const dot = mkEl(), ring = mkEl(), btn = mkEl(), ripples: { x: number; y: number }[] = [];
  const win = { innerWidth: 1000, innerHeight: 600, addEventListener(t: string, f: any) { (handlers[t] ??= []).push(f); }, removeEventListener(t: string, f: any) { handlers[t] = (handlers[t] ?? []).filter((x) => x !== f); } };
  const raf = (f: () => void) => q.push(f);
  const st = (f: () => void, ms: number) => { const t = { f, ms, id: ++tid, live: true }; timers.push(t); return t.id; };
  const ct = (id: number) => { const t = timers.find((x) => x.id === id); if (t) t.live = false; };
  return {
    dot, ring, btn, win, ripples, handlers, timers,
    frame() { const f = q.splice(0); f.forEach((x) => x()); return f.length; },
    fire(t: string, e?: any) { (handlers[t] ?? []).slice().forEach((h) => h(e)); },
    runTimers(ms: number) { timers.filter((t) => t.live && t.ms <= ms).forEach((t) => { t.live = false; t.f(); }); },
    raf, st, ct,
    document: { getElementById: (id: string) => (id === "cursorDot" ? dot : id === "cursorRing" ? ring : null), querySelectorAll: () => [btn], createElement: () => { const e = mkEl(); ripples.push(e as any); return e; }, body: { appendChild(e: any) { ripples[ripples.length - 1] = { x: parseFloat(e.style.left), y: parseFloat(e.style.top) } as any; } } },
  };
}
const SCRIPT: [string, any][] = [
  ["mousemove", { clientX: 100, clientY: 50 }], ["frame", 3], ["mousemove", { clientX: 900, clientY: 580 }], ["frame", 80],
  ["enter", 0], ["touchstart", { touches: [{ clientX: 10, clientY: 20 }] }], ["frame", 5], ["touchmove", { touches: [{ clientX: 300, clientY: 400 }] }], ["frame", 400],
  ["leave", 0], ["touchend", 0], ["touchstart", { touches: [] }], ["timers", 500], ["frame", 2], ["mousemove", { clientX: 5, clientY: 5 }], ["frame", 7],
];
function drive(w: ReturnType<typeof fakeWorld>, trace: string[]) {
  for (const [op, a] of SCRIPT) {
    if (op === "frame") for (let i = 0; i < a; i++) w.frame();
    else if (op === "timers") w.runTimers(a);
    else if (op === "enter" || op === "leave") (w.btn.h[op === "enter" ? "mouseenter" : "mouseleave"] ?? []).forEach((f: any) => f());
    else w.fire(op, a);
    trace.push(JSON.stringify([op, w.dot.style.opacity, w.dot.style.transform, w.ring.style.opacity, w.ring.style.transform, w.ring.style.width, w.ring.style.height]));
  }
}
test("cursor: port == v4 on a mouse+touch script (opacity, transforms, ring size, ripples, auto-hide)", () => {
  const a = fakeWorld(), ta: string[] = [];
  new Function("document", "window", "reduceMotion", "requestAnimationFrame", "setTimeout", "clearTimeout", FIX)(a.document, a.win, false, a.raf, a.st, a.ct);
  drive(a, ta);
  const b = fakeWorld(), tb: string[] = [];
  mountCursor({ win: b.win as any, raf: b.raf as any, caf: () => {}, setTimeout: b.st as any, clearTimeout: b.ct as any, interactive: [b.btn as any], spawnRipple: (x, y) => b.ripples.push({ x, y } as any) }, b.dot as any, b.ring as any);
  drive(b, tb);
  assert.deepEqual(tb, ta);
  assert.deepEqual(b.ripples.filter((r: any) => typeof r.x === "number").length, a.ripples.filter((r: any) => typeof r.x === "number").length);
});
test("cursor: step converges and stops; teardown removes listeners", () => {
  let s: any = { mx: 100, my: 100, dx: 0, dy: 0, rx: 0, ry: 0 }, n = 0;
  for (let x = stepFollower(s); x && n < 5000; x = stepFollower(s)) { s = x; n++; }
  assert.ok(n > 10 && n < 5000 && stepFollower(s) === null);
  const w = fakeWorld(); const off = mountCursor({ win: w.win as any, raf: w.raf as any, caf: () => {}, setTimeout: w.st as any, clearTimeout: w.ct as any, interactive: [w.btn as any], spawnRipple() {} }, w.dot as any, w.ring as any);
  assert.ok(w.handlers.mousemove.length === 1); off();
  assert.ok(Object.values(w.handlers).every((h) => h.length === 0) && (w.btn.h.mouseenter ?? []).length === 0);
});
