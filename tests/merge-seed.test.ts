import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import seed from "../content/seed.json";
import { mergeAdditions, serializeSeed } from "../lib/content/merge";

const S = seed as any;

test("merge: adds only new keys and does not mutate the input", () => {
  const before = JSON.stringify(S);
  const { data, report } = mergeAdditions(S, { texts: { "x.new": { ar: "جديد", en: "new" } } });
  assert.equal(JSON.stringify(S), before);
  assert.deepEqual(report.addedTexts, ["x.new"]);
  assert.equal(data.texts["x.new"].en, "new");
  assert.equal(Object.keys(data.texts).length, Object.keys(S.texts).length + 1);
});

test("merge: identical re-apply is a no-op; different value is a conflict and is kept unless force", () => {
  const k = "nav.about";
  const same = mergeAdditions(S, { texts: { [k]: S.texts[k] } });
  assert.deepEqual(same.report.identical, [`texts/${k}`]);
  const c = mergeAdditions(S, { texts: { [k]: { ar: "غير" } } });
  assert.deepEqual(c.report.conflicts, [`texts/${k}`]);
  assert.deepEqual(c.data.texts[k], S.texts[k]);
  const f = mergeAdditions(S, { texts: { [k]: { ar: "غير" } } }, { force: true });
  assert.equal(f.data.texts[k].ar, "غير");
});

test("merge: media gets id from key; collections append by id; unknown collection reported", () => {
  const { data, report } = mergeAdditions(S, {
    media: { "x.pic": { url: "/assets/x.webp", type: "image", alt: "" } },
    collections: { testimonials: [{ id: "t99" }], nope: [{ id: "a" }] },
  });
  assert.equal(data.media["x.pic"].id, "x.pic");
  assert.deepEqual(report.addedItems, ["testimonials/t99"]);
  assert.deepEqual(report.unknownCollections, ["nope"]);
});

test("serializeSeed reproduces the committed seed byte-for-byte (so a --write only changes what was added)", async () => {
  const { promises: fs } = await import("node:fs");
  const raw = await fs.readFile(path.join(process.cwd(), "content", "seed.json"), "utf8");
  assert.equal(serializeSeed(JSON.parse(raw)), raw);
});
