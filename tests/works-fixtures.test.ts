// STATUS: UNVERIFIED (Claude draft; run in the cloud sandbox only, not yet on the owner's machine)
/**
 * Guards the verbatim v4 copies in tests/fixtures/works-original-*.js. They are the ORACLE of every v7 test:
 * if one of them is edited by accident, the parity tests would silently compare against the wrong behaviour.
 * Hashes are taken over the content with CRLF normalised to LF, so a Windows checkout with autocrlf still passes.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

interface Pin {
  source: string;
  lines: number;
  first: string;
  last: string;
  sha256: string;
}

const PINS: Record<string, Pin> = {
  "works-original-fill-heading.js": {
    source: "site/index.html:2631-2659",
    lines: 29,
    first: "  // ---------- PORTFOLIO FILL HEADING ----------",
    last: "  }",
    sha256: "a39f70a4dda135ec074f229b556c390ff6d84af35a42183f652db9c7608a1eeb",
  },
  "works-original-playback.js": {
    source: "site/index.html:2301-2356",
    lines: 56,
    first: "  // ---------- STACK VIDEO PLAYBACK: ONLY THE FOCUSED CARD PLAYS ----------",
    last: "  })();",
    sha256: "a44e24a0885ed60f057a8f19d3f850dd2445f9d50efcc92729c0df24617032e9",
  },
  "works-original-category.js": {
    source: "site/index.html:2358-2629",
    lines: 272,
    first: "  // ---------- CATEGORY DETONATION ----------",
    last: "  document.querySelectorAll('.category-section').forEach(sec => catSectionObserver.observe(sec));",
    sha256: "9a9138b0086731c8d1618d2e82578d1bc7ed1c251c793ea11aab6e2e95226c1d",
  },
  "works-original-explosion-enh.js": {
    source: "site/js/enhancements.js:19-63",
    lines: 45,
    first: "  /* ---------- Canvas-2D explosion (overrides the Three.js version) ---------- */",
    last: "  window.run3DExplosion = explode2D;   // the page's runExplosion() calls this by name",
    sha256: "70a6729b6594120b8ddab50d5f5870acde275850577686e2fdb8b1e8702b8ffa",
  },
};

for (const [file, pin] of Object.entries(PINS)) {
  test(`fixture ${file} is still the verbatim v4 block (${pin.source})`, () => {
    const raw = readFileSync(new URL(`./fixtures/${file}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
    const lines = raw.replace(/\n$/, "").split("\n");
    assert.equal(lines.length, pin.lines, "line count");
    assert.equal(lines[0], pin.first, "first line");
    assert.equal(lines[lines.length - 1], pin.last, "last line");
    assert.equal(createHash("sha256").update(raw).digest("hex"), pin.sha256, "sha256 (LF-normalised)");
  });
}

test("fixtures carry no BOM and end with a single newline", () => {
  for (const file of Object.keys(PINS)) {
    const raw = readFileSync(new URL(`./fixtures/${file}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
    assert.notEqual(raw.charCodeAt(0), 0xfeff, `${file}: BOM`);
    assert.ok(raw.endsWith("\n") && !raw.endsWith("\n\n"), `${file}: trailing newline`);
  }
});
