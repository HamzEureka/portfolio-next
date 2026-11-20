import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import seed from "../content/seed.json";
import { alternatesFor, dirOf, fromAcceptLanguage, isLang, langFromPath, otherLang, pickLang, readCookie, switchHref } from "../lib/i18n";
import { auditI18n, classify, collectLTexts, isBlocking } from "../lib/i18n-audit";
import { scanCss } from "../lib/audit/css-scan";
import { findPhysical } from "../lib/rtl-audit";

test("dir/lang helpers", () => {
  assert.equal(dirOf("ar"), "rtl"); assert.equal(dirOf("en"), "ltr");
  assert.equal(otherLang("ar"), "en"); assert.equal(otherLang("en"), "ar");
  assert.ok(isLang("ar") && isLang("en") && !isLang("fr") && !isLang(undefined));
  assert.equal(langFromPath("/en/brief"), "en"); assert.equal(langFromPath("/"), null); assert.equal(langFromPath("/admin"), null);
});

test("switchHref keeps sub-path, trailing slash and hash", () => {
  assert.equal(switchHref("/ar", "en"), "/en");
  assert.equal(switchHref("/ar/", "en"), "/en");
  assert.equal(switchHref("/ar/brief", "en", "#x"), "/en/brief#x");
  assert.equal(switchHref("/en/brief/", "ar", "work"), "/ar/brief/#work");
  assert.equal(switchHref("/", "en"), "/en");
  assert.equal(switchHref("/admin", "en"), "/en/admin");
  assert.equal(switchHref("/english", "ar"), "/ar/english");     // not mistaken for the "en" prefix
});

test("Accept-Language / cookie selection", () => {
  assert.equal(fromAcceptLanguage("en-US,en;q=0.9,ar;q=0.8"), "en");
  assert.equal(fromAcceptLanguage("fr,ar-EG;q=0.5,en;q=0.4"), "ar");
  assert.equal(fromAcceptLanguage("fr,de"), null);
  assert.equal(fromAcceptLanguage("en;q=0,ar;q=0.1"), "ar");
  assert.equal(fromAcceptLanguage(null), null);
  assert.equal(pickLang({ cookie: "en" }), "en");
  assert.equal(pickLang({ cookie: "xx", acceptLanguage: "en" }), "ar");                       // v4 behavior: header ignored by default
  assert.equal(pickLang({ cookie: null, acceptLanguage: "en", useAcceptLanguage: true }), "en");
});

test("readCookie", () => {
  assert.equal(readCookie("a=1; portfolio-lang=en; b=2", "portfolio-lang"), "en");
  assert.equal(readCookie("xportfolio-lang=en", "portfolio-lang"), null);
  assert.equal(readCookie(null, "a"), null);
  assert.equal(readCookie("a=%E0%A4%A", "a"), null);
});

test("alternates", () => {
  assert.deepEqual(alternatesFor("en", "/brief"), { canonical: "/en/brief", languages: { ar: "/ar/brief", en: "/en/brief", "x-default": "/ar/brief" } });
});

test("i18n audit classifies; the current seed has no BLOCKING gaps (testimonials are Arabic-only by D12)", () => {
  assert.equal(classify("p", { ar: "نص" })?.kind, "needs-en");
  assert.equal(classify("p", { ar: "PORTFOLIO" })?.kind, "neutral-no-en");
  assert.equal(classify("p", { ar: "نص", en: "text مختلط" })?.kind, "en-has-arabic");
  assert.equal(classify("p", { ar: "a", en: "a" })?.kind, "en-equals-ar");
  assert.equal(classify("p", { ar: "نص", en: "text" }), null);
  const s = seed as any;
  assert.ok(collectLTexts(s).length > 100);
  assert.deepEqual(auditI18n(s).filter(isBlocking).map((f) => f.path), []);
});

test("rtl audit: flags asymmetric physical CSS, skips symmetric/centering, honors LTR overrides", () => {
  const f = findPhysical(scanCss(`
    .a{ left:0; right:0 }
    .b{ left:50%; transform:translateX(-50%) }
    .c{ right:27px }
    .d{ margin-left:8px }
    html[dir="ltr"] .d{ margin-left:0; margin-right:8px }
    .e{ background:linear-gradient(90deg,#000,#fff) }
    @keyframes k{ to{ transform:translateX(10px) } }
  `));
  assert.deepEqual(f.map((x) => [x.selector, x.prop, x.hasLtrOverride]), [[".c", "right", false], [".d", "margin-left", true], [".e", "background", false]]);
});

test("rtl audit on the real stylesheets finds the known LTR defects; the ltr-overrides.css proposal addresses them", async () => {
  const read = (p: string) => fs.readFile(path.join(process.cwd(), p), "utf8");
  const g = findPhysical(scanCss(await read("app/globals.css")));
  assert.ok(g.some((x) => x.selector === ".timeline::before" && x.prop === "right"));
  assert.ok(!g.some((x) => x.selector.includes("hero h1")), "existing html[dir=ltr] rules are not flagged");
  const o = await read("app/ltr-overrides.css");
  assert.match(o, /html\[dir="ltr"\] \.timeline::before\{[^}]*left:27px/);
  assert.match(o, /html\[dir="ltr"\] #scrollProgress\{[^}]*transform-origin:left/);
});
