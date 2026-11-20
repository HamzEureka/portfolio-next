// Pure helpers for publishing: find uploaded media inside content JSON and rewrite URLs to the published folder.
const UPLOAD_RE = /(?:^|\/)uploads\/([A-Za-z0-9][A-Za-z0-9._-]*\.[A-Za-z0-9]+)(?:[?#].*)?$/;

/** Walks any JSON value. Strings ending in /uploads/<file> are replaced by `${prefix}/<file>`; returns the new value and the list of files. */
export function rewriteUploads(value, prefix = "/media") {
  const files = new Set();
  const walk = (v) => {
    if (typeof v === "string") { const m = UPLOAD_RE.exec(v); if (m) { files.add(m[1]); return `${prefix}/${m[1]}`; } return v; }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = walk(x); return o; }
    return v;
  };
  return { content: walk(value), files: [...files] };
}

/** Security headers for the static host (Cloudflare `_headers` file). */
export const HEADERS_FILE = `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
/media/*
  Cache-Control: public, max-age=31536000, immutable
`;

/** Root page: the static host has no server to pick a language, so choose in the browser (saved choice, then browser language, then Arabic). */
export const ROOT_HTML = `<!doctype html><html lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>yossef salama</title>
<noscript><meta http-equiv="refresh" content="0;url=/ar/"></noscript>
<script>(function(){var l="ar";try{var m=document.cookie.match(/(?:^|; )(?:lang|portfolio-lang)=(ar|en)/);if(m)l=m[1];else if(/^en/i.test(navigator.language||""))l="en"}catch(e){}location.replace("/"+l+"/"+location.hash)})()</script></head><body></body></html>`;

export const wranglerConfig = ({ name, assetsDir }) => JSON.stringify({
  name, compatibility_date: "2026-11-01",
  assets: { directory: assetsDir, html_handling: "auto-trailing-slash", not_found_handling: "404-page" },
}, null, 2);
