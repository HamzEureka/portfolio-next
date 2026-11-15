# NEXT-STEPS — v7 (2026-11-15)
State: plan done (`STAGE-v7.md`, D14–D26). T1, T2 done in `portfolio-next-v7-overlay.zip`. `lib/works/*` = v4-parity base, UNVERIFIED, unwired: site behavior unchanged. Sandbox evidence only (Node 22): 280/280 tests, `verify_css` ok.

## 1. Owner: apply the overlay and run the check
`portfolio-next-v7-overlay.zip` holds only the 33 changed or new files, built on the owner's `portfolio-next-v6-final_3dbf56.zip` (identical to the earlier v6 zip). Unzipping it over the project root overwrites only those files and deletes nothing (media in `public/assets/` stays).
1. Safety check (PowerShell, project root). Only if all three match the project state of that zip, unzip over the root; if any differs, stop and send me that file:
   - `Get-FileHash content\seed.json` → `84DB229BD2CD2618BB6E344354769419B94CCB442C5AAC4907647915D9FA6BB`
   - `Get-FileHash tests\store.test.ts` → `C72ADD109D1B72DC2A9402C3264934313D1C3B79CCE2CDD55438D9849492C152`
   - `Get-FileHash SUMMARY.md` → `DF240752E08A9AA7A03851CD379CE908F2D3DBDB86D330982AC27421F09EB080`
   (If T2 was already applied by hand, `seed.json` and `store.test.ts` will differ: send them.)
2. Unzip the overlay over the project root, overwrite all.
3. `npm ci` then `npm run check`. Expected: tests 280 pass / 0 fail, typecheck, verify:css, build exit 0. Paste literal output. First failure → paste it and stop.
4. Git (paused): when resumed, branch `v7-works` from `main`; commit `feat(works): v7 base (T2 + lib/works)`.

## 2. Evidence on the base (T2b: GPT executes, Claude reviews)
2.1 In v4 `site/`, expected sha256 of line ranges (use Git Bash on Windows, LF only):
- `sed -n 2301,2356p index.html | sha256sum` → `a44e24a0885ed60f057a8f19d3f850dd2445f9d50efcc92729c0df24617032e9`
- `sed -n 2358,2629p index.html | sha256sum` → `9a9138b0086731c8d1618d2e82578d1bc7ed1c251c793ea11aab6e2e95226c1d`
- `sed -n 2631,2659p index.html | sha256sum` → `a39f70a4dda135ec074f229b556c390ff6d84af35a42183f652db9c7608a1eeb`
- `sed -n 19,63p js/enhancements.js | sha256sum` → `70a6729b6594120b8ddab50d5f5870acde275850577686e2fdb8b1e8702b8ffa`
2.2 Read-only audit of `tests/helpers/works-harness.ts` (~1070 lines): do fake timers, rAF, IntersectionObserver and `node:vm` world emulate the browser faithfully? Report format A/B (WORKFLOW §4). All parity tests depend on it.
2.3 Do not change `tests/fixtures/*` or the harness without telling Claude.

## 3. Build order
T3 `lib/works.ts` → T4 render → T5 `explode2D` → T6 controller → T7 playback → T7b heading fill → T8 checklist → T9 batch review. Details and accepts: `STAGE-v7.md` Tasks.
Per task: search-first line, small commit, report A/B, `npm run check`, GPT reviews DeepSeek.
Reuse: `focus.ts`, `sounds.ts`, `fill-heading.ts`, `contract.ts`, `detonation.ts` as is. Replace: v4 reset (`category-reveal.ts`, D22). Extend: `playback.ts` (D23/D19).
Do not wire `category-reveal.ts` `resetCategory` or `playback.ts` as they are (SUMMARY gap 17).
Each adopted module keeps `// STATUS: UNVERIFIED` until step 1.4 passes on the owner machine, then the header changes in one commit.

## 4. Owner decisions
No blocking decision. Veto window before T4: D25 (no CSS file, inline styles) and D26 (W5 heading fill inside v7). Silence = accepted.

## 5. Gate before v8
All STAGE accepts ✓ literal → `qa/v7-checklist.md` pass in browser (incl. Safari audio, 720px, reduced-motion) → owner visual review (rule 8) → `/Upgradeporto end` (SUMMARY gap 11 removed, v7 gaps logged, CHANGELOG line) → CI green → tag `v7` → `/Upgradeporto plan v8`. Open items to carry: `GAPS-TO-V8.md`.

## 6. New-chat start
```
/Upgradeporto Start
[Handoff yousef-portfolio 2026-11-15]
Stopped at: v7 base delivered (T1, T2 done); owner run of §1 pending.
Attach: SUMMARY.md, WORKFLOW.md, STAGE-v7.md, NEXT-STEPS.md, GAPS-TO-V8.md + literal `npm run check` output + files named in the task.
Verified (cmd→result): sandbox only: tsx --test 280/280, verify_css ok, fixtures sha = v4 ranges. | Unverified: tsc, build, browser, harness audit.
Owner decisions pending: none blocking (veto D25/D26 before T4).
Next task: T2b evidence, then T3.
Rules: WORKFLOW §2 (1–8) + search first. Reply only "ready" or blocking questions.
```
