import test from "node:test";
import assert from "node:assert/strict";
import { composeBriefRequest } from "../lib/brief";
import { BRIEF_LABELS_EN, briefLabels, composeBrief, toAsciiDigits } from "../lib/brief-i18n";

const raw = { name: " Ali ", whatsapp: "0599", ptype: "Reels", duration: "30s", platforms: ["IG", "TikTok"], notes: "hi" };

test("ar output is identical to the legacy composeBriefRequest (parity-locked by tests/brief.test.ts)", () => {
  assert.deepEqual(composeBrief(raw, "963988311431", "ar"), composeBriefRequest(raw, "963988311431"));
});

test("en output uses English labels and separator; link still wa.me/<digits>", () => {
  const r = composeBrief(raw, "+963 988-311431", "en");
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.message, ["New quote request", "", "Name: Ali", "WhatsApp: 0599", "Project type: Reels", "Video length: 30s", "Platforms: IG, TikTok", "Additional details: hi"].join("\n"));
    assert.ok(r.url.startsWith("https://wa.me/963988311431?text="));
  }
  assert.equal(briefLabels("en"), BRIEF_LABELS_EN);
});

test("Arabic-Indic digits in the configured number are converted (v4 dropped them)", () => {
  assert.equal(toAsciiDigits("٩٦٣٠٩٨٨ ۳۱۱۴۳۱ x12"), "9630988 311431 x12");
  const r = composeBrief(raw, "٩٦٣٩٨٨٣١١٤٣١", "ar");
  assert.ok(r.ok && r.url.startsWith("https://wa.me/963988311431?text="));
});

test("missing required fields are reported in both languages", () => {
  for (const l of ["ar", "en"] as const) assert.deepEqual(composeBrief({ name: "", whatsapp: "", ptype: "", duration: "" }, "1", l), { ok: false, missing: ["name", "whatsapp", "ptype", "duration"] });
});
