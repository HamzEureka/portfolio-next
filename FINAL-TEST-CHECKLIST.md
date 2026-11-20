# FINAL-TEST-CHECKLIST.md — one pass, owner machine, after the merge
Run in this order: A (automatic, ~5 min) → B (browser, per feature) → C (v4 side-by-side) → D (cross-cutting) → E (report).
Mark each line ✓ / ✗ / n/a. Anything ✗ goes into the E template. Nothing is "done" before this list is complete.
Setup: `npm run dev` for B–D; a production check at the end with `npm run build && npm start`. Test viewports: 360px phone, 720px (v7 breakpoint), 1280px desktop. Languages: `/ar` and `/en`. Themes: dark (default) and light.
Env: run once WITHOUT `NEXT_PUBLIC_API_BASE` / `NEXT_PUBLIC_ADMIN_API` and once WITH both pointing at any HTTP mock or your server.

## A. Automatic gate
Command (project root, PowerShell): `powershell -ExecutionPolicy Bypass -File scripts\final-gate.ps1`  (add `-SkipInstall` to skip `npm ci`). Output: `final-gate-report.txt`.
| # | Step | Expected |
|---|---|---|
| A1 | `npm ci` | 0 vulnerabilities |
| A2 | `npm test` | fail 0. Record the total (base was 280; merge adds new tests) |
| A3 | `npm run typecheck` | no errors (first thing likely to fail: TS 7.0.2 / React 19.3 types in new files) |
| A4 | `npm run verify:css` | pass; `globals.css` hash unchanged |
| A5 | `npm run build` | success; routes include `/` (dynamic), `/ar` and `/en` (now dynamic, M11), `/admin`, `/_not-found` |
| A6 | `audit_keys` | no unused/missing keys other than the ones listed in MERGE-REPORT |
| A7 | `audit_colors` | no new literal colors (known: `#000` mask in ltr-overrides, old ones in enhancements/skills.css) |
| A8 | `audit_i18n`, `audit_rtl`, `audit_theme` | read the output; list items needing a visual look (used in B2, B3) |
| A9 | `git status --short` | only intended files |
| A10 | Push the branch → CI (`ci.yml`) | green: https://github.com/HamzEureka/portfolio-next/actions |

## B. Browser, per feature
### B1. v7 Works (highest risk: nothing here has run in a browser yet)
1. Section shows category covers; a category never opened shows its cover; numbering restarts at 01 in each category (D20). Empty categories and items with an unknown category are not rendered.
2. "Open Category" opens directly: no countdown, no explosion (D19/D22). "Close Category" closes; `open` state is independent of the effect (D22).
3. The explosion button: countdown → explosion (~2.1 s, `DUR=2100`) → reveal. Compare feel with v4 side by side.
4. Reset: after the effect finished and the section scrolls out of view upward, the effect resets but an opened category stays open (D21/D22). Scroll back: nothing breaks.
5. Focused card video: the centered card plays muted automatically only when focus changes and no video is already playing. Only ONE video plays at a time. Starting another stops the previous (D19).
6. Pause a video by hand → it stays paused while focus moves away and back (userPaused is persistent, D23). Programmatic pause (e.g. leaving the screen) does NOT make it "user paused".
7. Opening another category does NOT stop the playing video. Closing the category that contains it DOES. Closing another category does not.
8. Sounds: explosion/countdown sound plays after a user gesture; Safari (macOS or iOS) included; no sound when the tab is muted/hidden; no console errors.
9. Heading fill (`#portfolioFillHeading`): fills on scroll as in v4.
10. 720px breakpoint layout, `prefers-reduced-motion` (no explosion animation, reveal still works), `/en` texts, RTL/LTR layout.
11. Navigate `/ar` ⇄ `/en` several times and unmount/mount the section: no console errors, CPU settles to idle (no leaked observers/timers/audio). Dev mode (StrictMode) shows no double-trigger.
12. Performance: explosion stays smooth on a mid-range phone (note device + fps feel).
### B2. v8 i18n / RTL
`/ar#work` → switch to `/en#work` keeps path and hash; Ctrl+Click opens a new tab; `html[lang]`/`dir` correct; cookie `portfolio-lang` set; open `/` first with cookie `en`, then with browser language Arabic, then neither (falls back to `DEFAULT_LANG`); `/en` timeline line is on the correct side (ltr-overrides); radial icons, `.nav-brand-anim`, `.brand-splash-icon`, `.meter i` look right in `/en`; tab title follows language; switching language with a category open reloads the tree (note what you see).
### B3. v9 theme / progress / hero
No light/dark flash on first load; default dark even if OS is light (as v4); theme toggle after the language button, persists (`portfolio-theme`); light mode full-page pass (hero::before, work-thumb, smoke-*, dialog backdrop, form-error); scroll progress bar moves (starts from the left in `/en`); hero background: 0-byte files → cover disappears; with real files: video on large screens, image on phone/data-saver, still image with reduced-motion; no hydration errors on `/ar` and `/en`.
### B4. v10 brief dialog
Opens; fields and validation as v4; WhatsApp message is in the UI language and digits are 0-9; Arabic digits typed are converted; no `/brief` page exists (by decision).
### B5. v11 /admin
Opens; without `NEXT_PUBLIC_ADMIN_API`: "Read-only" and save disabled; with it: texts edit sends PUT (Network tab); collections add/delete/reorder sends delete → put → order only for changes; `javascript:`/`data:` URL blocked; invalid email/WhatsApp number blocked; 360px layout; colors from variables only; server error shown clearly. Public site: quote dot with a single item → no NaN (spotlight fix). NOTE: no auth in the UI (server must enforce).
### B6. extras
Custom cursor: dot + ring, ring grows over links/buttons, fades ~0.5 s after stop, hidden with reduced-motion; touch ripple on phone; share button (phone: system sheet; desktop: copies link, shows ✓ then reverts ~1.8 s; `/en` English); "Add your review": opens, counter, validation (name <2, text <10), without API base → WhatsApp link in UI language; contact form: without API base → "could not send" (no fake success); with server → `POST /contact`; honeypot field invisible and, when filled, rejected by your server.
### B7. v12 audits
Already part of A6–A8. Nothing manual except reading the lists.

### B8. Server (M11) — start with `npm run server` + `npm run dev`; both env files set (see `server/README.md`)
1. `$env:ADMIN_TOKEN="<token>"; npm run smoke` → `SMOKE: PASS 9/9`.
2. `/admin`: wrong token → save shows a clear error (401), nothing changes; right token → saved; reload `/ar` and `/en` show the new text.
3. Collections in `/admin`: add a skill, reorder, delete → site reflects each; order survives a reload; add a work with a new category → it appears with its own cover.
4. Upload an image for `about.photo` → shown on the site (URL starts with the API origin). Upload an mp4 for a work → plays and seeking works (Range).
5. Contact form with the API up: message appears in `GET /inbox` (use `curl -H "Authorization: Bearer <token>" http://127.0.0.1:8000/inbox`); the 6th send within an hour is refused with the "limited" message; the hidden `website` field stays empty for humans.
6. Review form: stored in the inbox, NOT published; add it as a testimonial by hand in `/admin`.
7. `curl` a `javascript:` URL to `/media/about.photo` → 422 (server refuses even if the browser check is bypassed). Wrong token with `curl` → 401.
8. Stop the server: public forms fall back honestly (review → WhatsApp link; contact → "could not send"); `/admin` save shows an error, not a fake success. Start it again: all edits are still there.
9. `data/content.json.bak` exists after an edit. Delete `data/content.json`, restart the server → restored from the seed.
10. Production check: `npm run build && npm start` + server: an admin edit shows on `/ar` WITHOUT rebuilding (pages are rendered per request).
11. Origins: from a browser on another origin than `ALLOWED_ORIGINS` the API calls fail (CORS) — expected.

## C. v4 side-by-side (fidelity). Open v4 (`v4-reference/site/index.html` with any static server) next to `/ar`
Hero, nav + brand animation, about + counters, skills meters, works (v4 behavior vs v7), timeline, testimonials/spotlight, contact + radial icons, brief dialog, footer/thank-you text. Write down any visible difference (expected differences: spotlight NaN fix, language/theme buttons, cursor, share, review).
SSR check (not automated): view-source of `/ar` contains the Arabic text of hero/about; `/en` the English.

## D. Cross-cutting
1. Console clean (no errors/warnings that are new) on `/ar`, `/en`, `/admin`, in dev and in `npm start`.
2. Network: no failed/blocked requests when env vars are unset; nothing sent to a server when unset.
3. Keyboard: Tab through the page; every control reachable, visible focus, dialogs trap focus and close with Esc.
4. A11y quick pass: images have alt (`brand.logoAlt`), buttons have names, `lang`/`dir` set, contrast OK in both themes.
5. Browsers: Chrome + Firefox + Safari (or iOS Safari) at least once for B1, B3, B6.
6. `npm run build && npm start`: repeat B1 items 2–7 and B2 item 1 in the production build.

## E. Report template (send to Claude)
```
FINAL GATE RESULT  <date>  branch <name>  last commit <hash>
A: A1 ✓ A2 ✓(total N) A3 ✗ ... (paste final-gate-report.txt for any ✗)
B1: 1✓ 2✓ 3✗ ...   B2: ...   B3: ...   B4: ...   B5: ...   B6: ...
C: differences found: <list>
D: 1✓ 2✓ 3✗ ...
For each ✗: id | device/browser/lang/theme | what I saw | what I expected | console text (verbatim)
```
Claude replies per ✗ with: suspected phase (M1–M10) → cause → fix patch. After fixes: rerun A, then only the failed B/C/D items.
