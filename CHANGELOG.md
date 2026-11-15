# CHANGELOG.md — history (read on demand, not attached by default)

## 2026-11-15 — v6 merged
- `v6-merged.zip` (16 files; its MANIFEST says UNVERIFIED) was already applied in local copy `portfolio-next - Copy`, absent from `portfolio-next`. Unzipping over root would revert D9–D11 (`page.tsx`, `seed.json`), so only 12 new files were extracted (`components/Testimonials.tsx`, `lib/spotlight-ui/` ×4, `tests/helpers/spotlight-harness.ts`, 5 `spotlight-*` tests, `qa/v6-checklist.md`) and merged by hand: import + `<Testimonials/>` in `app/[lang]/page.tsx`, key `testimonials.dotLabel` in `seed.json`. `build_seed.py` and MANIFEST not used.
- Branch `v6-testimonials` (`cb89893 feat(testimonials): merge v6 spotlight (desktop + mobile) with tests`), PR #1 (16 files, +1463/−27), CI green; merge commit `cb7bb33` on `main`, CI green on `main`; local branch deleted. Owner-reported: typecheck, verify:css, build pass; 91 tests (11 + 80). Owner visual review passed via `qa/v6-checklist.md`, no changes asked. Decisions D12, D13. Open: `.gitattributes:1` warning; v6 deviations from v4 not reviewed line by line.
- Live files updated by delta to reflect the above.

## 2026-11-15 — token policy
- Skill, `WORKFLOW.md`, `SUMMARY.md`, `CHANGELOG.md`, `ai/executor-prompt.md` converted to terse English; Arabic kept only for site-content values. Caps: plan ≤6 lines, review ≤15, handoff ≤10. Live files updated by delta. Protocol text lives only in `WORKFLOW.md` §4; skill and prompt point to it. Token savings not measured.

## 2026-11-14 — search-first and escalation
- Search-first rule (docs → GitHub Issues → Stack Overflow → posts), accepted only if version/rules/command-safety fit; copied snippets attributed; logged in every report. Added to `WORKFLOW.md`, DeepSeek prompt, skill.
- Escalation table: GPT accepts routine passing tasks; Claude gets decisions, stalls, finished sub-stages.
- Framework research: Spec Kit (gates; criticized as paper-heavy), Aider architect mode (one plans, one executes), ETH AGENTbench (long context files lower success, raise cost), multi-agent review (evidence, delivery gates).
- Final delivery package: media names unified (`logo.svg`, `profile-photo.webp`, `hero-poster.jpg`, `hero-video.mp4`, `project-1..4.mp4`); `.gitignore` excludes `/public/assets/*` (tracks only `public/assets/README.txt`), `tsconfig.tsbuildinfo`, `next-env.d.ts`; versions pinned to lockfile (Next 16.4.4, React/React DOM 19.3.1, TypeScript 7.0.2, tsx 4.23.15); owner ran `npm ci` (31 pkgs, 0 vulnerabilities) + `npm run typecheck`: pass; added `npm run check`; de-duplicated live files; v4 analysis moved to `SOURCE-NOTES.md`.
- v6a: `lib/spotlight.ts` + `tests/spotlight.test.ts` run original v4 code (`tests/fixtures/spotlight-original.js`) in fake DOM, compared at many scroll positions, 1–6 cards, two widths, swipe, dot clicks. 11 tests pass; mutation test proves changed formula/threshold breaks them. Not wired to UI, not visually reviewed.

## 2026-11-14 — handover + content edits
- Handover: SHA256 check showed local folder = `portfolio-next-updated.zip`, not `-final`; 4 files differed (`tests/store.test.ts`, `scripts/build_seed.py`, `SUMMARY.md`, `WORKFLOW.md`); 2 lines changed (works video names → `project-N.mp4`), backup in `%TEMP%\portfolio-backup`. `assets/` moved to `public/assets/` (was not git-ignored). Hero files renamed; both 0 bytes (owner decision). Commit `a2d5281` pushed to `main`, CI run #3 green (31 s).
- Content edits (owner request): D8–D11. `tests/store.test.ts` hero.title assertion updated. Owner-reported pass: typecheck, test 11/11, verify:css, build.

## Routing and CI fix
- `6593a24 fix(routing): handle root redirect with route handler` on `origin/main`; Actions run #2 success (29 s). Cause: build failed, `app/[lang]/layout.tsx` doesn't cover `/` and no `app/layout.tsx`. Fix: delete `app/page.tsx`, add `app/route.ts` (D6, D7).
- `2aedcd2 ci: add GitHub Actions workflow with checkout@v7 and setup-node@v7.1.0`; `bd17824 chore: initial baseline snapshot before v6b`, tag `v0.5.0`.

## 2026-11-13 — v5
- Inventory of texts/media/scripts/dictionary/Brief (see `SOURCE-NOTES.md`). D1–D5 settled; 4 works only (owner decision).
- Built Next.js project: identical `globals.css` (sha256), bilingual seed (74 texts + 5 media + 13 groups), CRUD layer, section components, BriefDialog, Effects, skill-icon colors in `app/skills.css`.
- Server render vs index.html: 172/183 texts identical; rest = review form (not ported) and testimonial avatar initials.
- First session ran without an official stage prompt (not produced via `/interview-prompt`).
