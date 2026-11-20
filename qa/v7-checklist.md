# v7 Works — browser checklist (UNVERIFIED until the owner's final gate)
Mirrors FINAL-TEST-CHECKLIST §B1. Run `/ar` and `/en`; 360px, 720px, 1280px. Mark ✓ / ✗ / n/a; every ✗ goes into the §E report.
Temp data for items 12–14: in `data/content.json` (or the seed) add a second category and move one work to it; remove afterwards.

## Cover, burst, reveal (D18, D21, D22)
1. [ ] Category never opened shows its cover (bomb, label, CTA). Cards are hidden.
2. [ ] Click the cover → countdown 3, 2, 1 (700 ms apart, ticking sound) → boom + flash + shake + explosion (~2.1 s) → list appears with the fly-in (cards staggered). Compare with v4 side by side.
3. [ ] Click twice quickly → second click ignored.
4. [ ] After the reveal the cover is gone and does not come back (burst does not replay in the same page session; derived from D22, confirm).
5. [ ] Q1 (kept from v4): click, then scroll the section out of view upward during the count → list still opens 2200 ms after the click. Note what you see.

## Open / Close (D19, D22)
6. [ ] A "Close category" button shows above the opened list. Click → list hidden, "Open category" button shown (label of the category beside it).
7. [ ] "Open category" → list opens at once: no countdown, no explosion, no sound.
8. [ ] Scroll away upward after the reveal, come back → category is still open (reset touches the effect only).
9. [ ] Numbering restarts at 01 in each category (D20).
10. [ ] Category with no works is not rendered. A work whose `category` matches no category is not rendered.
11. [ ] Open/Close controls use existing look only (no new colors); keyboard: Tab reaches them, Enter/Space work; `aria-expanded` flips.

## Video (D19, D23) — needs real video files
12. [ ] Focused card (centered under the sticky band) auto-plays muted only when focus changes and nothing else is playing.
13. [ ] With two categories open: start a video in A, scroll to B → A keeps playing, B does not start. Start a video in B → A stops. Only one plays at a time.
14. [ ] Close the category that contains the playing video → it stops. Close a different category → it keeps playing. Opening a category never stops it.
15. [ ] Pause by hand → stays paused while scrolling away and back (sticky). Press play → plays; later it can be auto-paused by starting another and is NOT sticky then.
16. [ ] Video that ends: scrolling to focus it again may auto-play it again (not sticky).
17. [ ] Autoplay blocked by the browser (Safari/iOS low power) → no error, the controls still work.

## Sound, motion, layout
18. [ ] Sounds play only after the click (user gesture), including Safari/iOS; no console errors when the tab is muted or audio is blocked.
19. [ ] `prefers-reduced-motion: reduce` → no explosion animation (CSS), reveal still works.
20. [ ] 720px breakpoint and 360px phone: cover, controls and cards lay out correctly; `/ar` RTL and `/en` LTR.
21. [ ] Heading fill `#portfolioFillHeading` fills on scroll as in v4; with reduced motion it is shown filled.

## Lifecycle
22. [ ] Switch `/ar` ⇄ `/en` several times: no console errors; CPU idles after each switch (no leaked timers/observers/audio).
23. [ ] `npm run dev` (StrictMode): no double countdown, no double sound.
24. [ ] Explosion smooth on a mid-range phone (note device and feel).

## Known gaps kept on purpose (log)
- Cover is a `div` (no keyboard/role); explosion is frame-rate dependent; Q1; `preload` is `metadata` only for the first card of a category.
- Programmatic-pause marker depends on the native `pause` event order: verify item 15 in Chrome, Firefox and Safari.
