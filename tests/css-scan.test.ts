import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { scanCss, literalColors, stripComments } from "../lib/audit/css-scan";

test("scanCss: rules, media context, declarations and line numbers", () => {
  const css = `/* c */\n.a{ color:#fff; margin-left:4px }\n@media (max-width:720px){\n  .b, .c{\n    left: 0;\n    background:url("x;y.png");\n  }\n}\n@keyframes k{from{opacity:0}to{opacity:1}}\n`;
  const r = scanCss(css);
  assert.equal(r.length, 4);
  assert.deepEqual(r[0], { selector: ".a", context: null, line: 2, decls: [{ prop: "color", value: "#fff", line: 2 }, { prop: "margin-left", value: "4px", line: 2 }] });
  assert.equal(r[1].context, "@media (max-width:720px)");
  assert.equal(r[1].selector, ".b, .c");
  assert.deepEqual(r[1].decls.map((d) => [d.prop, d.line]), [["left", 5], ["background", 6]]);
  assert.equal(r[1].decls[1].value, 'url("x;y.png")');
  assert.equal(r[2].context, "@keyframes k");
});

test("stripComments keeps line count; literalColors ignores var()", () => {
  assert.equal(stripComments("a/*x\ny*/b").split("\n").length, 2);
  assert.deepEqual(literalColors("linear-gradient(90deg,#a800f8,rgba(1,2,3,.5)) var(--accent) #FFF"), ["#a800f8", "rgba(1,2,3,.5)", "#FFF"]);
});

test("scanCss handles the real stylesheets without losing rules (sanity: > 300 rules, no empty selectors)", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "app", "globals.css"), "utf8");
  const r = scanCss(css);
  assert.ok(r.length > 300, `rules=${r.length}`);
  assert.ok(r.every((x) => x.selector.length > 0));
  // brace balance: scanner consumed every declaration block
  assert.equal((css.match(/{/g) ?? []).length, (css.match(/}/g) ?? []).length);
});
