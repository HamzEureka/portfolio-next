// STATUS: UNVERIFIED (Claude draft)
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import {
  BRIEF_LABELS_AR, buildWaLink, buildWhatsappMessage, composeBriefRequest, normalizeBrief, validateBrief,
  type BriefLabels, type BriefRaw,
} from "../lib/brief";

type SubmitFn = (
  e: { preventDefault(): void; currentTarget: unknown },
  p: { whatsapp: string },
  setErr: (b: boolean) => void,
  window: { open(url: string, target: string, features: string): void },
) => void;

const submitOriginal = vm.runInNewContext(
  readFileSync(new URL("./fixtures/brief-dialog-submit.js", import.meta.url), "utf8"),
  { Array },
) as SubmitFn;

/** A fake <form> that answers the three queries the original submit() makes. */
function fakeForm(raw: BriefRaw) {
  const text: Record<string, string | undefined> = {
    name: raw.name, whatsapp: raw.whatsapp, duration: raw.duration, count: raw.count,
    ref: raw.ref, deadline: raw.deadline, budget: raw.budget, notes: raw.notes,
  };
  return {
    elements: { namedItem: (n: string) => (text[n] === undefined ? null : { value: text[n] as string }) },
    querySelector: (sel: string) => {
      if (sel === 'input[name="ptype"]:checked') return raw.ptype === undefined ? null : { value: raw.ptype };
      if (sel === 'input[name="footage"]:checked') return raw.footage === undefined ? null : { value: raw.footage };
      throw new Error("unexpected selector " + sel);
    },
    querySelectorAll: (sel: string) => {
      if (sel === 'input[name="platform"]:checked') return (raw.platforms ?? []).map((value) => ({ value }));
      throw new Error("unexpected selector " + sel);
    },
  };
}

interface Outcome { err: boolean | null; opened: Array<[string, string, string]> }

function runOriginal(raw: BriefRaw, whatsapp: string): Outcome {
  const out: Outcome = { err: null, opened: [] };
  const form = fakeForm(raw);
  submitOriginal({ preventDefault() {}, currentTarget: form }, { whatsapp }, (b) => { out.err = b; }, {
    open: (u, t, f) => { out.opened.push([u, t, f]); },
  });
  return out;
}

/** What a component would do with the pure functions (same observable effects as the original). */
function runPure(raw: BriefRaw, whatsapp: string): Outcome {
  const out: Outcome = { err: false, opened: [] };
  const r = composeBriefRequest(raw, whatsapp);
  if (!r.ok) out.err = true;
  else out.opened.push([r.url, "_blank", "noopener"]);
  return out;
}

// ---- 1) parity with the current BriefDialog.submit(): full grid of field combinations ----
test("parity with BriefDialog.submit(): every combination of field values", () => {
  const names = ["", "   ", "Ali", "  علي  "];
  const was = ["", "+963 988 311 431", "٠٩٦٣٩٨٨", "abc"];
  const ptypes = [undefined, "إعلان تجاري"];
  const durations = ["", "  أقل من دقيقة "];
  const counts = ["", " 5 "];
  const footages = [undefined, "جاهزة بالكامل"];
  const platformSets: string[][] = [[], ["انستجرام"], ["انستجرام", "تيك توك"]];
  const refs = ["", " https://x.y/z?a=1&b=2 "];
  const deadlines = ["", "2026-12-01"];
  const budgets = ["", "أقل من 1000 جنيه"];
  const notesList = ["", " سطر 1\nسطر 2 & رموز ?=#% "];
  let n = 0;
  for (const name of names) for (const whatsapp of was) for (const ptype of ptypes) for (const duration of durations)
    for (const count of counts) for (const footage of footages) for (const platforms of platformSets)
      for (const ref of refs) for (const deadline of deadlines) for (const budget of budgets) for (const notes of notesList) {
        const raw: BriefRaw = { name, whatsapp, ptype, duration, count, footage, platforms, ref, deadline, budget, notes };
        assert.deepStrictEqual(runPure(raw, "963988311431"), runOriginal(raw, "963988311431"), JSON.stringify(raw));
        n++;
      }
  assert.equal(n, 4 * 4 * 2 * 2 * 2 * 2 * 3 * 2 * 2 * 2 * 2);
});

test("parity: the wa.me number is the digits of the configured number (including the empty-number quirk)", () => {
  const raw: BriefRaw = { name: "A", whatsapp: "1", ptype: "x", duration: "y" };
  for (const number of ["963988311431", "+963 98 831 1431", "", "no digits", "٠٩٦٣"]) {
    assert.deepStrictEqual(runPure(raw, number), runOriginal(raw, number), number);
  }
  assert.ok(runPure(raw, "").opened[0][0].startsWith("https://wa.me/?text="), "empty number keeps the original shape");
});

// ---- 2) the exact text, locked ----
test("message text for a full request", () => {
  const msg = buildWhatsappMessage(normalizeBrief({
    name: " يوسف ", whatsapp: "+963 988", ptype: "إعلان تجاري", duration: "أقل من دقيقة", count: "5",
    footage: "جاهزة بالكامل", platforms: ["انستجرام", "تيك توك"], ref: "رابط", deadline: "2026-12-01",
    budget: "أقل من 1000 جنيه", notes: "ملاحظة",
  }));
  assert.equal(msg, [
    "طلب عرض سعر جديد", "", "الاسم: يوسف", "واتساب: +963 988", "نوع المشروع: إعلان تجاري", "مدة الفيديو: أقل من دقيقة",
    "عدد الفيديوهات: 5", "المادة الخام: جاهزة بالكامل", "المنصات: انستجرام، تيك توك", "مرجعية بصرية: رابط",
    "تاريخ التسليم المطلوب: 2026-12-01", "الميزانية التقريبية: أقل من 1000 جنيه", "تفاصيل إضافية: ملاحظة",
  ].join("\n"));
});

test("message text keeps only the required lines when nothing optional is filled", () => {
  const msg = buildWhatsappMessage(normalizeBrief({ name: "A", whatsapp: "1", ptype: "x", duration: "y" }));
  assert.equal(msg.split("\n").length, 6);
});

// ---- 3) validation ----
test("validateBrief reports exactly the missing required fields", () => {
  assert.deepEqual(validateBrief({ name: "", whatsapp: "", ptype: "", duration: "" }), {
    ok: false, missing: ["name", "whatsapp", "ptype", "duration"],
  });
  assert.deepEqual(validateBrief({ name: "A", whatsapp: "1", ptype: "", duration: "3" }), { ok: false, missing: ["ptype"] });
  assert.deepEqual(validateBrief({ name: "A", whatsapp: "1", ptype: "x", duration: "3" }), { ok: true });
});

test("normalizeBrief trims text fields but not ptype/footage, and copies platforms", () => {
  const platforms = ["a"];
  const v = normalizeBrief({ name: " n ", ptype: " p ", footage: " f ", platforms });
  assert.equal(v.name, "n");
  assert.equal(v.ptype, " p ");
  assert.equal(v.footage, " f ");
  assert.notEqual(v.platforms, platforms);
  assert.deepEqual(normalizeBrief({}).platforms, []);
});

// ---- 4) the labels hook (v8 may pass localized labels) ----
test("custom labels change only the prefixes", () => {
  const en: BriefLabels = {
    title: "New quote request", name: "Name: ", whatsapp: "WhatsApp: ", ptype: "Project type: ", duration: "Video length: ",
    count: "Videos: ", footage: "Raw footage: ", platforms: "Platforms: ", ref: "References: ", deadline: "Deadline: ",
    budget: "Budget: ", notes: "Notes: ", platformsSeparator: ", ",
  };
  const v = normalizeBrief({ name: "A", whatsapp: "1", ptype: "x", duration: "y", platforms: ["p", "q"] });
  assert.equal(buildWhatsappMessage(v, en), "New quote request\n\nName: A\nWhatsApp: 1\nProject type: x\nVideo length: y\nPlatforms: p, q");
  assert.equal(buildWhatsappMessage(v, BRIEF_LABELS_AR), buildWhatsappMessage(v));
});

test("buildWaLink strips non-digits and encodes the message", () => {
  assert.equal(buildWaLink("+963 98-8", "a b\nc"), "https://wa.me/963988?text=a%20b%0Ac");
});
