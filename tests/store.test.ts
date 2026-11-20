import test from "node:test";
import assert from "node:assert/strict";
import seed from "../content/seed.json";
import { MemoryStore, ConflictError, NotFoundError } from "../lib/content/store";
import type { ContentData } from "../lib/content/types";

const fresh = () => new MemoryStore(structuredClone(seed) as unknown as ContentData);

test("seed has the v4 content", async () => {
  const s = fresh();
  assert.equal((await s.list("testimonials")).length, 4);
  assert.equal((await s.list("process")).length, 5);
  assert.equal((await s.list("works")).length, 4);
  assert.equal((await s.list("skills")).length, 4);
  assert.equal((await s.getText("hero.title"))?.ar, "الفيديو الحلو مو اللي انصوّر منيح هو اللي انمنتج صح");
  assert.match((await s.getText("hero.title"))?.en ?? "", /edited right/);
  assert.equal((await s.getMedia("about.photo"))?.url, "/assets/profile-photo.webp");
});

test("every translatable text has en; none missing", () => {
  assert.deepEqual((seed as any).missingEnglish, []);
});

test("work videos use the agreed lowercase asset filenames", async () => {
  const w = await fresh().list("works");
  assert.deepEqual(w.map((x) => x.video), [1, 2, 3, 4].map((i) => `/assets/project-${i}.mp4`));
});

test("collection CRUD", async () => {
  const s = fresh();
  const item = { id: "t5", text: { ar: "x" }, name: { ar: "n" }, role: { ar: "r" } };
  await s.create("testimonials", item);
  await assert.rejects(s.create("testimonials", item), ConflictError);
  assert.equal((await s.get("testimonials", "t5"))?.name.ar, "n");
  const u = await s.update("testimonials", "t5", { id: "HIJACK" as any, name: { ar: "m" } });
  assert.equal(u.id, "t5"); assert.equal(u.name.ar, "m");
  await assert.rejects(s.update("testimonials", "nope", {}), NotFoundError);
  assert.equal(await s.remove("testimonials", "t5"), true);
  assert.equal(await s.remove("testimonials", "t5"), false);
});

test("text and media CRUD, persist hook fires", async () => {
  let saves = 0;
  const s = new MemoryStore(structuredClone(seed) as unknown as ContentData, () => { saves++; });
  await s.setText("hero.title", { ar: "جديد", en: "new" });
  assert.equal((await s.getText("hero.title"))?.en, "new");
  const m = await s.setMedia("hero.poster", { url: "/assets/p.jpg", type: "image" });
  assert.equal(m.id, "hero.poster");
  assert.equal(await s.deleteMedia("hero.poster"), true);
  assert.equal(await s.deleteText("hero.title"), true);
  assert.equal(saves, 4);
});

test("list returns copies (no leaking mutation)", async () => {
  const s = fresh();
  (await s.list("process")).pop();
  assert.equal((await s.list("process")).length, 5);
});

// v7 T2: Works open/close controls (D24) and category model facts (D15, D17, D20)
test("works.open and works.close exist with ar and en", async () => {
  const s = fresh();
  for (const k of ["works.open", "works.close"]) {
    const t = await s.getText(k);
    assert.ok(t?.ar && t?.en, `${k} needs ar and en`);
  }
});

test("all works belong to category social", async () => {
  const w = await fresh().list("works");
  assert.ok(w.length > 0);
  assert.ok(w.every((x) => x.category === "social"));
});

test("moving a work via update changes grouping", async () => {
  const s = fresh();
  const [first] = await s.list("works");
  await s.update("works", first.id, { category: "other" });
  const after = await s.list("works");
  assert.equal(after.filter((x) => x.category === "social").length, 3);
  assert.equal(after.filter((x) => x.category === "other").length, 1);
});
