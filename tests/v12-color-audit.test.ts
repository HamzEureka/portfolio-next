import test from "node:test";
import assert from "node:assert/strict";
import { auditColors } from "../lib/audit/color-audit";
test("color audit: literal colors flagged, var() and comments not", () => {
  const h = auditColors({ "x.css": ".a{color:var(--text);background:#fff}\n/* .b{color:#000} */\n.c{border:1px solid rgba(0,0,0,.4)}" });
  assert.deepEqual(h.map((x) => [x.prop, x.value]), [["background", "#fff"], ["border", "1px solid rgba(0,0,0,.4)"]]);
});
