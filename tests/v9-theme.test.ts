import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { World, runOriginal, FEl } from "./helpers/enh-harness";
import { DEFAULT_THEME, THEME_ANIM_MS, THEME_INIT_SCRIPT, THEME_KEY, initTheme, nextTheme, normalizeTheme, toggleTheme } from "../lib/theme";

const STORES: Array<[string, any]> = [["empty", {}], ["light", { [THEME_KEY]: "light" }], ["dark", { [THEME_KEY]: "dark" }], ["blocked", "throws"]];

test("theme: initial data-theme equals v4 for every valid storage state", async () => {
  for (const [name, storage] of STORES) {
    const a = new World({ storage, noHero: true }); await runOriginal(a);
    const b = new World({ storage, noHero: true }); initTheme(b.root, b.storage);
    assert.equal(b.root.dataset.theme, a.root.dataset.theme, name);
  }
  assert.equal(DEFAULT_THEME, "dark");
});

test("theme: only documented deviation — an unknown stored value becomes dark (v4 wrote it raw, which looks identical: no [data-theme=x] CSS)", async () => {
  const a = new World({ storage: { [THEME_KEY]: "weird" }, noHero: true }); await runOriginal(a);
  assert.equal(a.root.dataset.theme, "weird");
  const b = new World({ storage: { [THEME_KEY]: "weird" } }); initTheme(b.root, b.storage);
  assert.equal(b.root.dataset.theme, "dark");
});

test("theme: toggle sequence (dataset, .theme-anim window, storage writes) equals v4", async () => {
  for (const [name, storage] of STORES) {
    const a = new World({ storage, noHero: true }); await runOriginal(a);
    const btn = a.navLinks!.find((e) => e.attrs.class === "theme-btn")!;
    const b = new World({ storage, noHero: true }); initTheme(b.root, b.storage);
    const trace = (w: World) => [w.root.dataset.theme, w.root.classList.contains("theme-anim"), JSON.stringify(w.storageWrites)];
    const A: any[] = [trace(a)], B: any[] = [trace(b)];
    for (let i = 0; i < 3; i++) {
      btn.fire("click"); toggleTheme(b.env);
      A.push(trace(a)); B.push(trace(b));
      a.tick(THEME_ANIM_MS - 1); b.tick(THEME_ANIM_MS - 1); A.push(trace(a)); B.push(trace(b));
      a.tick(1); b.tick(1); A.push(trace(a)); B.push(trace(b));
    }
    assert.deepEqual(B, A, name);
  }
  assert.equal(THEME_ANIM_MS, 450);
});

test("theme: nextTheme/normalizeTheme", () => {
  assert.equal(nextTheme("light"), "dark"); assert.equal(nextTheme("dark"), "light"); assert.equal(nextTheme(undefined), "light");
  assert.equal(normalizeTheme("light"), "light"); assert.equal(normalizeTheme(null), "dark");
});

test("theme: the inline <head> script gives the same result as initTheme", () => {
  for (const [name, storage] of STORES) {
    const w = new World({ storage, noHero: true });
    vm.runInContext(THEME_INIT_SCRIPT, vm.createContext(w.g));
    const v = new World({ storage, noHero: true }); initTheme(v.root, v.storage);
    assert.equal(w.root.dataset.theme, v.root.dataset.theme, name);
  }
  new FEl("x");
});
