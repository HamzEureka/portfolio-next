import test from "node:test";
import assert from "node:assert/strict";
import seed from "../content/seed.json";
import { safeUrl, validKey, validId, validateLText, validWhatsapp } from "../lib/admin/validate";
import { inferFields, validateItem, blankItem, type Item } from "../lib/admin/schema";
import { diffCollection, syncCollection, moveItem, newId } from "../lib/admin/diff";
import { HttpAdminApi, AdminApiError, type AdminApi } from "../lib/admin/api";

const S = seed as any;

test("safeUrl: allows http(s)/mailto/tel/relative; refuses script-capable and protocol-relative URLs", () => {
  for (const ok of ["https://a.b/c", "http://x", "mailto:a@b.co", "tel:+963", "/assets/a.mp4", "assets/a.mp4", "#x"]) assert.ok(safeUrl(ok), ok);
  for (const bad of ["javascript:alert(1)", " JaVa\nScRiPt:alert(1)", "data:text/html,x", "vbscript:x", "file:///etc/passwd", "//evil.com/x", "/\\evil.com", "", "ftp://x"]) assert.ok(!safeUrl(bad), bad);
});

test("key/id/ltext/phone validators", () => {
  assert.ok(validKey("hero.title") && validKey("about.stats") && validKey("works.items[0]") && !validKey("Hero.title") && !validKey("a b") && !validKey("a..b"));
  assert.ok(validId("t1") && validId("work-1") && !validId("") && !validId("a b") && !validId("-x"));
  assert.equal(validateLText({ ar: "x" }), null); assert.ok(validateLText({ en: "x" })); assert.ok(validateLText({ ar: "" }, { requireAr: true })); assert.ok(validateLText({ ar: "x".repeat(5001) }));
  assert.ok(validWhatsapp("+963 988-311431") && validWhatsapp("٠٩٦٣٩٨٨٣١١٤٣١") && !validWhatsapp("abc"));
});

test("schemas inferred from the real seed validate every existing item (no false rejections)", () => {
  for (const [name, items] of Object.entries<Item[]>(S.collections)) {
    const fields = inferFields(items);
    for (const it of items) assert.deepEqual(validateItem(name, fields, it), [], `${name}/${it.id}`);
  }
});

test("schema inference: kinds, nullable, contact.links by id, blank items", () => {
  const w = inferFields(S.collections.works) , by = Object.fromEntries(w.map((f) => [f.name, f]));
  assert.equal(by.title.kind, "ltext"); assert.equal(by.order.kind, "number"); assert.equal(by.video.kind, "url");
  assert.ok(by.poster.nullable && by.poster.kind === "url"); assert.ok(by.tag.nullable && by.tag.kind === "ltext");
  const lf = inferFields(S.collections["contact.links"]);
  const bad = { id: "whatsapp", value: "javascript:x" } as Item;
  assert.ok(validateItem("contact.links", lf, bad).some((e) => e.field === "value"));
  assert.ok(validateItem("contact.links", lf, { id: "email", value: "not-an-email" }).length);
  assert.deepEqual(validateItem("works", w, { ...S.collections.works[0], video: "javascript:alert(1)" }).map((e) => e.field), ["video"]);
  assert.deepEqual(blankItem(w, "w9").title, { ar: "" });
});

test("diffCollection: minimal ops; moveItem; newId", () => {
  const A = [{ id: "a", n: 1 }, { id: "b", n: 2 }, { id: "c", n: 3 }] as Item[];
  assert.deepEqual(diffCollection(A, A), { puts: [], deletes: [], reorder: null });
  assert.deepEqual(diffCollection(A, [A[0], { id: "b", n: 9 }, A[2]]), { puts: [{ id: "b", n: 9 }], deletes: [], reorder: null });
  assert.deepEqual(diffCollection(A, [A[0], A[2]]), { puts: [], deletes: ["b"], reorder: null });
  assert.deepEqual(diffCollection(A, moveItem(A, "c", -1)).reorder, ["a", "c", "b"]);
  assert.deepEqual(diffCollection(A, [...A, { id: "d", n: 4 }]), { puts: [{ id: "d", n: 4 }], deletes: [], reorder: ["a", "b", "c", "d"] });
  assert.equal(moveItem(A, "a", -1), A); assert.equal(newId("t", ["t1", "t2"]), "t3"); assert.equal(newId("t", ["t2"]), "t2".replace("2", "2") === "t2" ? "t2" === "t2" ? "t3" : "" : "");
});

test("syncCollection order of calls (delete, put, order) and partial-failure report", async () => {
  const calls: string[] = [];
  const api = { putItem: async (c: string, i: Item) => { calls.push(`put ${i.id}`); }, deleteItem: async (c: string, id: string) => { calls.push(`del ${id}`); }, setOrder: async (c: string, ids: string[]) => { calls.push(`order ${ids}`); } } as unknown as AdminApi;
  const A = [{ id: "a" }, { id: "b" }] as Item[];
  const r = await syncCollection(api, "x", A, [{ id: "b" }, { id: "n", v: 1 }] as Item[]);
  assert.deepEqual(calls, ["del a", "put n", "order b,n"]); assert.deepEqual(r, { done: 3, total: 3 });
  const bad = { ...api, putItem: async () => { throw new Error("boom"); } } as unknown as AdminApi;
  await assert.rejects(() => syncCollection(bad, "x", A, [{ id: "z" }] as Item[]), /boom/);
});

test("HttpAdminApi: URLs, methods, bearer token, JSON bodies, errors", async () => {
  const seen: any[] = [];
  const f = async (url: string, init: any) => { seen.push([init.method, url, init.headers.Authorization ?? null, init.body ?? null]); return { ok: !url.includes("fail"), status: url.includes("fail") ? 403 : 200, text: async () => "denied", json: async () => ({ url: "/assets/x.webp" }) }; };
  const api = new HttpAdminApi("https://srv.test/api/", () => "tok", f as any);
  await api.putText("hero.title", { ar: "x" });
  await api.putItem("works.categories", { id: "social", label: { ar: "a" } } as Item);
  await api.deleteItem("testimonials", "t 1");
  await api.setOrder("works", ["w2", "w1"]);
  await api.putMedia({ id: "about.photo", url: "/a.webp", type: "image" });
  assert.deepEqual(seen.map((s) => [s[0], s[1], s[2]]), [
    ["PUT", "https://srv.test/api/texts/hero.title", "Bearer tok"], ["PUT", "https://srv.test/api/collections/works.categories/social", "Bearer tok"],
    ["DELETE", "https://srv.test/api/collections/testimonials/t%201", "Bearer tok"], ["PUT", "https://srv.test/api/collections/works/order", "Bearer tok"], ["PUT", "https://srv.test/api/media/about.photo", "Bearer tok"]]);
  assert.equal(seen[3][3], JSON.stringify({ ids: ["w2", "w1"] }));
  await assert.rejects(() => new HttpAdminApi("https://srv.test/fail", () => null, f as any).putText("k.k", { ar: "" }), (e: any) => e instanceof AdminApiError && e.status === 403 && e.message === "denied");
  assert.deepEqual(await new HttpAdminApi("https://srv.test", () => null, f as any).uploadMedia(new Blob(["x"]), "x.webp"), { url: "/assets/x.webp" });
});
