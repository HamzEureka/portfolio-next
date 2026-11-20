import test from "node:test";
import assert from "node:assert/strict";
import { checkUpload, uploadKindForField, friendlyError, itemTitle, textGroup, collectionLabel, fieldLabel, hiddenField } from "../lib/admin/upload";

test("checkUpload: 70 MB video passes, over-limit/wrong type/empty are refused in Arabic", () => {
  assert.equal(checkUpload({ name: "a.MP4", size: 70 * 1048576 }, "video"), null);
  assert.equal(checkUpload({ name: "a.mp4", size: 100 * 1048576 }, "video"), null);
  assert.match(checkUpload({ name: "a.mp4", size: 101 * 1048576 }, "video")!, /الحد الأقصى 100/);
  assert.match(checkUpload({ name: "a.mov", size: 5 }, "video")!, /MP4/);
  assert.match(checkUpload({ name: "a.svg", size: 5 }, "image")!, /JPG/);
  assert.match(checkUpload({ name: "a.jpg", size: 0 }, "image")!, /فارغ/);
  assert.equal(checkUpload({ name: "p.webp", size: 1000 }, "image", 1), null);
});
test("upload fields are only works.video and works.poster", () => {
  assert.equal(uploadKindForField("works", "video"), "video");
  assert.equal(uploadKindForField("works", "poster"), "image");
  assert.equal(uploadKindForField("works", "title"), null);
  assert.equal(uploadKindForField("contact.links", "value"), null);
  assert.equal(hiddenField("works", "order"), true);
});
test("friendlyError maps statuses to plain Arabic", () => {
  assert.match(friendlyError(null, ""), /تعذّر الاتصال/);
  assert.match(friendlyError(401, ""), /كلمة السر/);
  assert.match(friendlyError(413, ""), /أكبر/);
  assert.match(friendlyError(429, ""), /انتظر/);
  assert.match(friendlyError(500, ""), /السيرفر/);
});
test("labels and titles", () => {
  assert.equal(itemTitle({ id: "w1", title: { ar: "ريلز قهوة" } }), "ريلز قهوة");
  assert.equal(itemTitle({ id: "x1" }), "x1");
  assert.equal(textGroup("hero.title"), "الصفحة الرئيسية");
  assert.equal(textGroup("zzz.k"), "أخرى");
  assert.equal(collectionLabel("works"), "الأعمال");
  assert.equal(fieldLabel("video"), "الفيديو");
});
