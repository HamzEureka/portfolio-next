# CHANGES-SINCE-V8 — context for the model doing the merge
(ملخص بالعربية: هذا الملف يشرح كل ما أُضيف من v8 حتى الآن. الجزء A هو الدمج السابق M0–M11، والجزء B هو ما تغيّر بعده، والجزء C قائمة الملفات الدقيقة.)

Project: Next.js 16 / React 19 portfolio for a video editor ("yossef salama"), Arabic-first (`/ar`, `/en`), plus a zero-dependency Node API server (`server/`) and an admin page (`/admin`). All content lives in `content/seed.json`, edited at runtime through `data/content.json`. **No SQL database.**
Nothing below was verified on the owner's machine. Sandbox evidence only: Node 22, tsx, `tsx --test tests/*.test.ts` = **487 pass / 0 fail**, `node scripts/verify_css.mjs` ok. NOT run anywhere: `npm ci`, real `tsc` (TS 7 / React 19.3 types), `next build`, a real browser session of the Next app, CI.

## A. What was merged before (batch M0–M11, base commit d300890 = v6-final + v7 overlay, 280 tests)
| Phase | What |
|---|---|
| M1 | `lib/works.ts`: pure Works logic (reveal/openNow/reset, playback state `{playingId, focusedId, userPaused[]}`) |
| M2 | `components/Works.tsx`: `useReducer(categoryReducer)`, cover stays mounted until first open, Open/Close buttons use `cat-cover-cta` |
| M3 | `lib/works/explosion.ts`, `browser.ts`: port of v4 `explode2D` (DUR=2100), parity-tested against the verbatim v4 fixture in a vm |
| M4 | `lib/works-ui/controller.ts`, `dom.ts`: countdown, boom, flash, shake, explosion, fly-in, cleanup; `dispose()`; StrictMode-safe |
| M5 | `lib/works-ui/playback.ts`, `events.ts`, `components/WorksPlayback.tsx`: one video at a time, manual pause sticks, `portfolio:works-close` window event |
| M6 | `components/WorksFillHeading.tsx` (renderless, mounts `lib/works/fill-heading.ts`) |
| M7a/b | 58 proposal files added (v8 LangSwitch, v9 theme/progress/hero background, v10 brief dialog, v11 spotlight, extras: review dialog, interactions, contact form handler, v12), 10 patches applied (3 page patches needed a manual import hunk), seed +32 texts |
| M8 | literals moved to keys (`contact.thanks`, `brand.logoAlt`) |
| M9 | `qa/v7-checklist.md` (24 browser items) |
| M10 | docs, `AdminApp` hydration fix (`useState("")` + `useEffect(readToken)`) |
| M11 | server built to the existing client contract (`docs/admin-api-contract.md`): `server/{app,validate,multipart,ratelimit,index}.mjs`, 33 tests over real HTTP, `scripts/e2e-smoke.mjs`; `app/[lang]/page.tsx` has `export const dynamic = "force-dynamic"`; server writes `data/content.json` which `lib/content/index.ts` reads (one file, one host) |
Deliberate deviations from v4 (kept): controller/playback `dispose()`, React owns cover/list visibility, reset skips v4's hide-list/show-cover half, cover without `.cat-countdown` is not detonated, one observer per category, playback scope = stack-card videos, focus change never pauses.
Rules that must stay: `app/globals.css` is frozen (sha256 checked by `scripts/verify_css.mjs`); never edit it. `lib/works.ts` sits next to the `lib/works/` folder (`@/lib/works` must resolve to the file).

## B. What changed after M11 (this is the overlay)
1. **Redesign "green portal" (matches the owner's approved preview `New_site_preview_v2 (showreel ring + timeline)`)**
   - NEW `app/theme-portal.css`, imported in `app/[lang]/layout.tsx` after skills.css and before `ltr-overrides.css`. Overrides tokens only (`--bg #050605`, `--accent #3bff1f`, `--glow 59,255,31`, light theme green). Contains: glass nav, pill buttons, hero (16:9 ring image + WebGL fog + showreel reel + timecode), glass cards, green category covers, bottom timeline bar.
   - NEW `public/theme/hero-ring.webp` (desktop) and `hero-ring-m.webp` (mobile): the hero image (committed, not git-ignored).
   - NEW `components/HeroFx.tsx`: WebGL fog (CSS fallback), showreel circle with REC + ticking timecode; cleans up its RAF/observer. NEW `components/ScrollTimeline.tsx`: fixed bottom editing-timeline bar, one clip per section (`hero, about, work, process, contact`), playhead follows scroll.
   - `app/[lang]/page.tsx` (+13 lines only): imports `HeroFx`, `ScrollTimeline`; hero section gets `id="hero"`, drops `wrap`, adds `<div className="hero-bg">` and `<HeroFx />`; logo `<img>` replaced by `<span className="brand-logo-mask">` (CSS mask, colored by `--accent`) in nav and footer; `<ScrollTimeline …/>` before `ReviewDialog`.
   - `content/seed.json`: +`timeline.start`, `timeline.label` (ar+en); file re-serialized with `serializeSeed` (a test requires byte-for-byte equality).
   - NEW `public/assets/logo.svg`: green neon ring + "Y" monogram (original logo was not available).
   - Side effects to know: `.brand-splash{display:none}` (intro splash hidden; delete the rule to restore), `.hero-bg-media{display:none}` so `hero.poster`/`hero.video` media slots are no longer rendered by `HeroBackground` (component still mounted, harmless), `html[dir=ltr]` mirrors hero image/fog/reel.
   - The reel shows CSS placeholder frames. Not wired to a real showreel video yet.
2. **Admin for a non-technical owner (Arabic UI, upload buttons)**
   - REWRITTEN `components/admin/AdminApp.tsx`: tabs "الصور والفيديو / الأعمال والمحتوى / النصوص"; password field + "تحقق" (calls `GET /auth/check`); `works.video` and `works.poster` get an upload button with progress bar, client-side type/size check, Arabic errors; category select; unsaved-changes banner; no ids/URLs shown.
   - NEW `lib/admin/upload.ts` (pure helpers: `checkUpload`, `uploadKindForField`, Arabic labels, `friendlyError`) + NEW `tests/admin-upload.test.ts` (4 tests).
   - `lib/admin/api.ts`: optional `uploadWithProgress` (XMLHttpRequest, 30 min timeout) and `checkAuth` on `AdminApi`/`HttpAdminApi`; default fetch path unchanged.
   - `app/admin/layout.tsx` (`lang=ar dir=rtl`), `app/admin/admin.css` (+ var()-only styles, `.adm section{padding:16px 0}` to neutralize `globals.css` `section{padding:128px 0}`).
   - `.env.example`: `NEXT_PUBLIC_MAX_UPLOAD_MB=100`.
   - `server/index.mjs`: `server.requestTimeout` 120 s → 30 min (70 MB uploads on slow connections). Tested with a real 70 MB upload + Range request against `server/index.mjs`. `MAX_UPLOAD_MB` default stays 100.
3. **Security headers**: `next.config.ts` adds nosniff, X-Frame-Options SAMEORIGIN, Referrer-Policy, Permissions-Policy (no CSP on purpose: inline theme script).
4. **Cleanup (deleted, see DELETIONS.txt)**: planning docs (MERGE-PLAN, NEXT-STEPS, STAGE-v7, V7-STATUS, WORKFLOW, GAPS-TO-V8, SUMMARY, MERGE-REPORT, CHANGELOG, docs/T3-TASK), `content/proposals/` (already merged into seed), `scripts/build_seed.py` (stale), `scripts/merge_seed_additions.ts`, 5 old QA checklists. KEPT on purpose: `tests/fixtures/*` (v4 parity), `lib/content/merge.ts` + its test, `qa/v7-checklist.md`, `FINAL-TEST-CHECKLIST.md`, `TEST-PLAN-AR.md`, `scripts/final-gate.ps1`.
5. **New docs**: `ADMIN-GUIDE-AR.md` (owner's guide), `DEPLOY-AR.md` (VPS + Cloudflare Tunnel + Access, systemd, backups), README + `server/README.md` + `public/assets/README.txt` + `FINAL-TEST-CHECKLIST.md` small edits.

## C. Decisions already taken with the owner (do not reopen)
- Auth: a single shared `ADMIN_TOKEN` in `server/.env` (bearer; sha256 + timingSafeEqual; 10 failed tries / 15 min throttle). `/admin` page itself has no login. Plan: protect `/admin` with Cloudflare Access (email one-time PIN) at the proxy.
- Hosting: one VPS runs `next start` (3000) + `server/index.mjs` (8000) on the same machine (shared `data/content.json`); Cloudflare for DNS/HTTPS/Tunnel. Vercel/Pages/Workers do NOT fit (read-only FS, 4.5 MB function body limit). Cloudflare free proxy caps request bodies at 100 MB.
- Storage: JSON files in `data/` (`content.json`, `reviews.json`, `messages.json`, `uploads/`). Owner expects up to 8 videos × 70 MB. No SQL.
- T3 means lib/works.ts in the old plan and is already done (M1). Do not "implement T3".

## D. Known gaps / open items
- Unverified on the owner's machine: real `tsc` 7.0.2, `next build`, browser behavior (explosion, Safari audio, programmatic-pause marker, hydration of `LangSwitch`/theme script/`HeroFx`), CI.
- Contact form markup is `<form className="reveal">` without `method`/`action`: before hydration a submit would be a GET. `ContactFormHandler` does `preventDefault` after hydration. Not fixed yet.
- Possible inert buttons (share / review / works effects) flagged by an earlier review; not audited in this overlay.
- `package.json` has no `engines`, no `.nvmrc` (Node 24 is required), version still 0.5.0.
- Uploads replaced in admin are never deleted from `data/uploads/`. No backups beyond `.bak`. Review moderation UI missing.
- Fonts: 6 Google font families via a render-blocking `<link>` in `layout.tsx` (next/font would be better; needs a visual check).
- `<img>` everywhere (no srcset/lazy beyond one).
- Hero showreel not connected to a real video; `hero.video`/`hero.poster` slots unused by the new hero.
- `tests/works-detonation.test.ts` `scene`, `lib/spotlight-ui/index.ts` `Unmount`, `lib/works/sounds.ts` `Sounds`: pre-existing unused declarations.
