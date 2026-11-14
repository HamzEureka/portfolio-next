// Verifies app/globals.css is byte-identical to the CSS extracted from the v4 <style> block.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const EXPECTED = "6e4c55d2e977d11730ce76d3ae4605fe4c04c15a85e1ea0f5f870817896ff460"; // from v4 (40,694 bytes)
const got = createHash("sha256").update(readFileSync(new URL("../app/globals.css", import.meta.url))).digest("hex");
if (got !== EXPECTED) { console.error("globals.css differs from v4 CSS:", got); process.exit(1); }
console.log("globals.css matches v4 CSS (sha256 ok)");
