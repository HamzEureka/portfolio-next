import test from "node:test";
import assert from "node:assert/strict";
import { auditKeys } from "../lib/audit/key-audit";

test("key audit: unused, missing, hardcoded JSX text/attrs; comments ignored; collection/media names are not 'missing'", () => {
  const files = {
    "a.tsx": [`// "hero.zzz"`, `const a = t("hero.title");`, `const b = t("hero.gone"); // t("hero.alsoGone")`, `s.list("works.categories");`, `<div>مرحبا</div>`, `<img alt="logo" />`, `<b>{n}</b>`].join("\n"),
    "b.ts": `const k = "nav.menu";`,
  };
  const r = auditKeys(["hero.title", "nav.menu", "footer.copy", "brief.projectX"], files, ["brief."], ["works.categories"]);
  assert.deepEqual(r.unusedKeys, ["footer.copy"]);
  assert.deepEqual(r.missingKeys, ["hero.gone"]);
  assert.deepEqual(r.hardcoded.map((h) => h.text), ["مرحبا", 'alt="logo"']);
});
