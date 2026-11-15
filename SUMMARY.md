# SUMMARY.md — `portfolio-next` current state only
Updated: 2026-11-15. History: `CHANGELOG.md`. v4 analysis: `SOURCE-NOTES.md`. Rules/stages/decisions: `WORKFLOW.md`.

## 0. Where we are
- **Done:** v5 base (Next.js App Router + TypeScript, `/ar` `/en`, CRUD content layer, identical CSS); v6 (v6a–e: `lib/spotlight.ts` + `components/Testimonials.tsx`, desktop + mobile modes) merged to `main` via PR #1 (merge commit `cb7bb33`). Owner visual review of v6 passed (`qa/v6-checklist.md`, no changes requested).
- **v7 in progress (plan done):** `STAGE-v7.md` (D14–D26). Delivered as zip, not yet run by owner: T2 content keys + `lib/works/*` v4-parity base (unwired, UNVERIFIED, gap 15). Next: owner runs `NEXT-STEPS.md` §1–2, then T3. Gaps toward v8: `GAPS-TO-V8.md`.
- **GitHub:** `HamzEureka/portfolio-next` (private); `origin/main` = `cb7bb33`; CI green on the PR branch and on `main` (owner checked the Actions page). Not pushed yet: this SUMMARY/WORKFLOW/CHANGELOG update. Git work paused by owner (2026-11-15): v7 base arrives as `portfolio-next-v7-overlay.zip` (changed/new files only, hash-checked first, see `NEXT-STEPS.md` §1); never unzip a full-project zip over the repo root.

## 1. Verified / unverified
| Check | Status | Who / when |
|---|---|---|
| `npm ci` (31 pkgs, 0 vulnerabilities) | pass | owner, 2026-11-14 package |
| `typecheck`, `npm test` (91/91), `verify:css`, `build` | pass | owner, on `v6-testimonials` before merge (summary reported, raw output not seen) |
| CI | green | PR #1 branch and `main` after merge (`cb7bb33`) |
| Browser look, whole site (v5 + v6) | full visual review done, rated good (2 non-critical notes: gap 10) | owner |
| v6 Testimonials checklist | pass, no changes asked | owner, `qa/v6-checklist.md` |
| Hero media files | 0 bytes | owner decision; replace with originals when available |
| Local `npm run check` on `main` after merge | not reported | CI runs the equivalent |
| v7 base: `tsx --test` 280/280 (v6 91 + T2 3 + proposal 186), `verify:css` ok | pass | Claude, cloud sandbox, Node 22, no `npm ci`; **not on owner machine** |
| v7 verbatim fixtures = v4 lines (idx 2301–2356, 2358–2629, 2631–2659; enhancements.js 19–63), sha256 | match | Claude, from `yousef-portfolio-v4.zip` |
| `tsc --noEmit` on v7 files | ? | not runnable in sandbox (no `node_modules`) |
| v7 modules in a browser | not tested | no UI wired yet |
**Now:** owner runs `NEXT-STEPS.md` §1 (`npm ci && npm run check` with the v7 base merged; expect 280 tests), then T3.

## 2. Inventory (key ← current value)
### 2.1 Texts (live source = `content/seed.json`, D8; Source column = origin in v4)
| Key | Value | Source |
|---|---|---|
| nav.about / skills / work / process / contact | نبذة / المهارات / الأعمال / مسار العمل / تواصل | static HTML |
| nav.cta | احكيلي عن مشروعك | static HTML |
| brand.name | yossef salama | static HTML |
| splash.title / name / role | PORTFOLIO / yossef salama / Video Editor | static HTML |
| hero.eyebrow | مونتير فيديو ومصمم موشن جرافيك | content.json |
| hero.title | الفيديو الحلو مش اللي اتصور كويس هو اللي اتمنتج صح | content.json |
| hero.sub | بستلم اللقطات الخام… من أول ثانية | content.json |
| hero.cta1 / cta2 | اتفرج على الأعمال / احكيلي عن مشروعك | content.json |
| hero.counter | +20 مشروع مكتمل منذ 2025 | content.json |
| about.bgTextAr / bgTextEn | أهلاً أنا يوسف سلامة / Video Editor | static HTML |
| about.paragraphs[0..2] | 3 paragraphs | content.json |
| about.stats[0..2] (n,label) | 1 سنوات خبرة / 20+ مشروع منجز / 5+ عميل وعلامة تجارية | content.json |
| skills.title / idx | الأدوات والمهارات / 02 / المهارات | static HTML |
| skills.items[0..3] (name,percent,badge/icon) | Premiere Pro 95 (Pr) / After Effects 50 (Ae) / CapCut 99 (SVG) / Canva 99 (SVG) | static HTML (not in content.json) |
| works.title / idx / heading | مختارات من الأعمال / 03 / الأعمال / PORTFOLIO | static HTML |
| works.categories[0] (id,label,cta) | social / سوشيال ميديا / دوس هنا | static HTML |
| works.open / works.close | افتح الفئة / سكّر الفئة (en: Open category / Close category) | v7 T2, D24 (new) |
| works.items[0..3] (title,desc,tag,video,poster) | see 2.2 (5–8 removed) | static HTML |
| process.* | whole section from `process[0..4]` (title,text) | content.json |
| testimonials.heading | What Clients Are Saying 🥰 (stays English in both langs, D12) | static HTML |
| testimonials.items[0..3] (text,name,role) | 4 quotes, Arabic only, no `en` (D12); 1st and 4th same person, near-duplicate text | content.json |
| testimonials.dotLabel | added in v6 (dots aria label) | seed.json |
| review.cta.prompt / button | جرّبت العمل مع يوسف؟ / أضف رأيك | static HTML |
| contact.eyebrow / name / role | للتواصل / يوسف سلامة / Video Editor | static HTML |
| contact.email / whatsapp / instagram / facebook | values in content.json; facebook = `https://www.facebook.com/` (generic) | content.json |
| contact.share | شارك البورتفوليو | static HTML |
| contact.thanks | THANK YOU FOR YOUR TIME WATCHING | static HTML |
| contactForm.* | 4 fields + button «إرسال الطلب» (name, email, msg, labels, placeholders, submit) | static HTML |
| footer.copy / tagline | © 2026 يوسف سلامة… / مصمم ومبني بعناية… | static HTML |
| brief.* (dialog) | title, description, 4 sections, 7 project types, 5 durations, 3 material states, 5 platforms, 5 budgets (USD, D10), submit note | static HTML (option lists need a list model) |
| reviewForm.* | title, 3 fields, messages, note | static HTML |

Content edits 2026-11-14: D9 light Shami dialect in ~17 Arabic texts (`hero.title`, `hero.sub`, `hero.cta1`, `process.title`, one process step, `brief.sub`, `brief.submitNote`, `brief.s1.hint`, `brief.s3.hint`, `brief.s4.hint`, `brief.ph.ref`, `brief.ph.notes`, some brief option labels); testimonials untouched. D11 language button `ar` (was ع). D10 budgets in USD. Table values for these keys are v4 originals: read current values from `content/seed.json`.

### 2.2 Media
| Key | Current path | Note |
|---|---|---|
| brand.logo | `logo.svg` | used 3× (nav, splash, footer) |
| about.photo | `profile-photo.webp` | same as contact.avatar |
| hero.poster / hero.video | `hero-poster.jpg` / `hero-video.mp4` | via `data-*` on a script; local files are 0 bytes (owner decision) |
| works.items[0..3].video | assets/project-1.mp4 .. project-4.mp4 | poster empty; files local, not in package |
| works.items[4..7] | — | **decided:** 4 only, cards 5–8 removed; more via admin later |
| skills.items[2..3].icon | inline SVG (CapCut, Canva) | extract to SVG files or keep as component |
Local media in `public/assets/` (git-ignored on purpose; never in zip/GitHub): `logo.svg`, `profile-photo.webp`, `hero-poster.jpg`, `hero-video.mp4`, `project-1.mp4`–`project-4.mp4`. `hero-poster.jpg` and `hero-video.mp4` are currently empty (0 bytes).

## 3. Known gaps
1. **Hero media files are empty** (0 bytes, owner decision): replace with originals when available.
2. Not ported yet: cursor, focused-card video playback, category burst (v7: modules in `lib/works/`, not wired to UI), theme/hero background/progress bar (v9), "add review" form, share button, contact form handler (see stage map).
3. Standalone `/brief` page scheduled for v10 (`#brief` dialog exists).
4. `desktopScrollTarget` yields `NaN` at `n = 1` (as in original); harmless with 4 testimonials. v6 MANIFEST also left "single-card state" open; unchanged. **TODO:** verify/fix the single-card case before v11 (admin can delete testimonials) and re-check in v12 audit.
5. Original skips testimonial dots under `prefers-reduced-motion`; whether v6 handles it is unconfirmed.
6. 34 literal colors outside variables remain in `globals.css` for fidelity; unifying them is a separate decision/stage.
7. Green `next build`/CI doesn't prove visual fidelity or touch behavior; that is owner review.
8. v6 intentionally deviates from v4 in a few places (listed in v6 `MANIFEST.md`, not in repo): cancelAnimationFrame only on final removal, empty touch lists don't throw, resume timers always cleared, resize listener removed on teardown. Not reviewed line by line.
9. `qa/v6-checklist.md` expects English testimonials in `/en`; data is Arabic only (D12). Checklist item mismatches data; not a v6 defect.
10. Owner's first visual review noted: hero text stays English when switching language, testimonials stay Arabic in both. Cause not investigated; owner: not important.
11. **v7 open decisions (settle in plan):** works titles are numbers 1..4, descriptions empty; no poster images; only category `social`; who defines categories/titles and how many categories for the burst effect. **Settled in `STAGE-v7.md` (D14–D24); remove this gap at v7 close.**
12. `.gitattributes:1` warning ("Default: is not a valid attribute name"), not fixed, no build impact. A BOM at the start of `.gitattributes` and `ci.yml` was noted earlier (cosmetic, CI passes).
13. v11 note: testimonials/heading Arabic-field values are English or Arabic-only, which may confuse the admin panel; adding `en` needs no `tr` change (falls back to `ar`).
14. Budget ranges in the brief are initial USD values; adjust in `seed.json` to real pricing.
15. v7 base modules (`lib/works/*`, `tests/works-*.test.ts`, `tests/helpers/works-harness.ts`, `tests/fixtures/works-original-*.js`) are from an earlier session (DeepSeek + Claude), headers `STATUS: UNVERIFIED`. Harness (~1070 lines) not audited line by line; no browser run; adapters to real DOM/React not written. Flip the header only after the owner's own run.
16. v7 deliberately kept v4 gaps (log at close): cover is a `div` (no keyboard/role); explosion is frame-rate dependent; Q1 (reset mid-run does not cancel timers); dead fallback CSS (`.particle`, `.smoke-*`) stays (`globals.css` locked); after first reveal the burst does not replay in the same session (D22, derived, confirm in checklist).
17. `lib/works/category-reveal.ts` (`resetCategory` hides list/restores cover) and `playback.ts` (no sticky `userPaused`, no close-category rule) conflict with D22/D23: do not wire as-is; T3/T6/T7 replace or extend.
18. Works heading fill (`#portfolioFillHeading`, `.sfh-*`): v6 `page.tsx` renders markup only; no scroll script until T7b.

## 4. Content and layers (quick reference)
- `content/seed.json`: **sole text source (D8)**; 74 texts `{ar,en}` + 5 media + 13 groups at v5, plus `testimonials.dotLabel` (v6) and `works.open`/`works.close` (v7 T2; 77 texts now). Generated once from v4 by `scripts/build_seed.py`: **never re-run** (wipes D9–D11 edits). Testimonials/names untranslated by design.
- `lib/content`: `ContentStore` (texts/media/groups; list/get/create/update/remove) + `MemoryStore`; `DEFAULT_LANG = "ar"`.
- `app/globals.css`: identical to v4 CSS (sha256 `6e4c55d2…ff460`, 40,694 bytes), checked by `scripts/verify_css.mjs`; `app/skills.css` for skill-icon colors (same values).
- `lib/spotlight.ts`: `mobileCardStyle`, `mobileActiveDot`, `mobileNext`, `mobileSwipe`, `desktopGap`, `desktopActiveFloat`, `desktopNearest`, `desktopCardStyle`, `desktopScrollTarget` + constants (`MOBILE_QUERY` 720px, advance 4500ms, swipe 40px, resume 3000ms). Parity tests run original v4 code in a fake DOM (with mutation test).
- v6 UI: `components/Testimonials.tsx`, `lib/spotlight-ui/{contract,desktop,mobile,index}.ts`; tests `tests/spotlight-{harness,desktop,mobile,mount,lifecycle}.test.ts` + `tests/helpers/spotlight-harness.ts` (91 tests total: 11 + 80); manual checklist `qa/v6-checklist.md`.
- v7 base (unwired): `lib/works/{contract,focus,playback,sounds,detonation,category-reveal,fill-heading}.ts` (v4 parity, injected env: no `document`/`window`/`Math.random`), tests `tests/works-*.test.ts` (+ `.ds.` twin suites), `tests/helpers/works-harness.ts`, v4 verbatim blocks `tests/fixtures/works-original-*.js`. 280 tests total.
- `app/[lang]/page.tsx` renders `<Testimonials/>`; language button shows `ar` on the EN page (D11). `tests/store.test.ts` asserts the `hero.title` literal: changing it requires updating the test.
- Routing: `app/route.ts` redirects `/` to `/${DEFAULT_LANG}` (D6/D7); can't coexist with `app/page.tsx`.

## 5. Environment
Node.js 24, npm. Pinned per `package-lock.json`: Next 16.4.4, React/React DOM 19.3.1, TypeScript 7.0.2, tsx 4.23.15 (locked snapshot, not a claim of latest). Never send `node_modules/`, `.next/`, `.git/`, `.env*`.
