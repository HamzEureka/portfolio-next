# GAPS-TO-V8 (2026-11-15)
Sources: SUMMARY §3, STAGE-v7. "Src" = from source reading, not browser-verified.

## A. Must finish inside v7 (v8 does not start before)
| # | Item | Task |
|---|---|---|
| A1 | Owner run of base: `npm ci && npm run check` (280 tests expected) | NEXT §1 |
| A2 | Harness audit + fixtures sha check | T2b |
| A3 | `lib/works.ts`: grouping, reducer (D22), playback policy (D19/D23) | T3 |
| A4 | `Works.tsx` rewrite: cover kept until first open, Open/Close controls, empty/unknown categories hidden | T4 |
| A5 | `explode2D` port (only missing v4 piece) + audio adapter | T5 |
| A6 | Controller: countdown, boom, reveal, effect-only reset, IO, teardown, StrictMode, Q1 | T6 |
| A7 | Playback wiring (sticky pause, close rules, one video globally) | T7 |
| A8 | Heading fill script | T7b |
| A9 | `qa/v7-checklist.md` + owner visual review + CI green + `end` | T8, T9 |

## B. Unverified (carry to checklist)
- Browser behavior of every v7 module (nothing wired); Safari/WebKit audio (autoplay policy, un-awaited `resume()`); explosion performance.
- `tsc` and `next build` on v7 files (sandbox had no `node_modules`; Node 22 vs project Node 24; tsx 4.23.12 vs pinned 4.23.15).
- `pause` event cannot tell who paused: programmatic-pause marker (D23) is unproven in a browser.
- `CoverParts` contract vs real `Works.tsx` DOM: matches by class names only (Src); adapters unwritten.
- v6 vs `cb7bb33` blob match (P2, waived).

## C. Known and accepted for v7 (log at close, SUMMARY gaps 15–18)
Cover is a `div` (no keyboard/role) · explosion frame-rate dependent · Q1 (reset mid-run keeps timers) · dead fallback CSS stays (`globals.css` locked) · burst does not replay after first reveal (D22, derived) · `preload` metadata only for first card (v6 deviation) · modules `UNVERIFIED` until owner run.

## D. Carried from earlier stages (SUMMARY §3)
1 hero media 0 bytes · 3 `/brief` page (v10) · 4 `desktopScrollTarget` NaN at n=1 (before v11) · 5 testimonial dots under reduced-motion unconfirmed · 6 34 literal colors · 8 v6 deviations not line-reviewed · 9 v6 checklist expects English testimonials · 10 hero/testimonial language notes · 12 `.gitattributes` warning/BOM · 13 admin vs Arabic-only fields · 14 budget values.

## E. Check before planning v8 (i18n + RTL/LTR)
- Texts with `ar` only: `works.heading`, `works.liveTag`, testimonials, `hero` English parts (gap 10): decide which get `en` (falls back to `ar` via `tr`).
- New Open/Close buttons use inline styles: no `left/right`/physical margins; verify in LTR (`/en`).
- Category `label`/`cta` are `{ar,en}`; works titles are numbers, language-independent (D14).
- Focus/sticky logic uses `top` only; explosion canvas uses cover rect: symmetric, expected RTL-safe (Src), confirm in checklist at `/en`.
- Language switch while a category is open or a video plays: state/video continuity not specified; add to v7 checklist or v8 plan.
- `reduced-motion`: CSS only, no JS check (v4 parity); v8/v9 may revisit.
