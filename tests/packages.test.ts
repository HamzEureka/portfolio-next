import test from "node:test";
import assert from "node:assert/strict";
import seed from "../content/seed.json";
import { validateItem } from "../server/validate.mjs";
import { inferFields } from "../lib/admin/schema";
const texts: Record<string, unknown> = (seed as { texts: Record<string, unknown> }).texts;

test("seed contains packages collection with 3 placeholder packages", (t) => {
  const pkgs = seed.collections?.packages ?? [];
  assert.equal(pkgs.length, 3);
  for (const p of pkgs) {
    assert.ok(["pkg-1","pkg-2","pkg-3"].includes(p.id), `unexpected package id: ${p.id}`);
    assert.ok(p.name && typeof p.name.ar === "string", "package.name.ar missing");
    assert.ok(p.price && typeof p.price.ar === "string", "package.price.ar missing");
    assert.ok(p.features && typeof p.features.ar === "string", "package.features.ar missing");
  }
});

test("packages price is placeholder 0", () => {
  const pkgs = seed.collections?.packages ?? [];
  for (const p of pkgs) {
    assert.equal(p.price.ar, "0");
    assert.equal(p.price.en, "0");
  }
});

test("packages navigation keys exist in seed texts (ar+en)", () => {
  for (const k of ["nav.packages","packages.title","packages.idx","packages.cta"]) {
    const v = texts[k] as { ar?: unknown; en?: unknown } | undefined;
    assert.ok(v && typeof v.ar === "string" && typeof v.en === "string", `missing or incomplete text: ${k}`);
  }
});

test("validateItem accepts a valid package", () => {
  const err = validateItem("packages", { id: "pkg-x", name: { ar: "باقة X", en: "Package X" }, price: { ar: "150$", en: "150$" }, features: { ar: "ميزة 1\nميزة 2", en: "Feature 1\nFeature 2" } }, "pkg-x");
  assert.equal(err, null);
});

test("validateItem rejects invalid package id", () => {
  const err = validateItem("packages", { id: "bad id!", name: { ar: "X", en: "X" }, price: { ar: "0", en: "0" }, features: { ar: "ف", en: "f" } }, "bad id!");
  assert.ok(err && typeof err === "string" && err.includes("invalid id"));
});

test("validateItem rejects unknown field", () => {
  const err = validateItem("packages", { id: "pkg-x", name: { ar: "X", en: "X" }, price: { ar: "0", en: "0" }, features: { ar: "ف", en: "f" }, extra: "nope" }, "pkg-x");
  assert.ok(err && typeof err === "string" && err.includes("unknown field"));
});

test("inferFields infers name/price/features as ltext", () => {
  const pkgs = seed.collections?.packages ?? [];
  const fields = inferFields(pkgs);
  const kind = (name: string) => fields.find((f) => f.name === name)?.kind;
  assert.equal(kind("name"), "ltext");
  assert.equal(kind("price"), "ltext");
  assert.equal(kind("features"), "ltext");
});
