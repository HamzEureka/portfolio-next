// STATUS: UNVERIFIED (DeepSeek draft, reviewed by Claude; tsx --test + tsc passed in the cloud sandbox only, not yet on the owner's machine)
/**
 * W7: category reveal and reset (v4 site/index.html:2579-2592, 2604-2614, 2620-2629).
 *
 * QUIRKS (preserved from the original v4 code):
 * - `dataset.done` is falsy both when absent and when `""` (after a reset); reset writes `""`, not `delete` and not `"0"`
 *   (index.html:2609, 2623).
 * - The observer ignores intersecting entries and entries that left through the top (`top <= 0`) (index.html:2624).
 * - Only sections whose cover is `done` are reset; other categories are untouched (index.html:2623).
 * - Reveal hides the cover even when `projects` is absent (index.html:2580-2583).
 * - Reveal delays use the exact expression `(i * 0.08) + 's'`, so default number formatting is observable
 *   (index.html:2588).
 * - Reset removes both countdown classes in ONE `remove('show', 'pulse')` call (index.html:2613).
 *
 * DEVIATIONS:
 * - `mountSectionReset` returns an idempotent `Unmount` that calls `observer.disconnect()`. The original never disconnects
 *   (index.html:2620-2629).
 * - Element lookup is injected through `CoverParts` as required by the contract; the original queries `document` using
 *   `cover.dataset.cat` (index.html:2582, 2606). This is the contract seam, not a behaviour change.
 */
import type { CoverParts, MountSectionReset, ResetCategory, RevealProjects } from "./contract";

// SOURCE: index.html:2580-2590
export const revealProjects: RevealProjects = (parts: CoverParts): void => {
  // SOURCE: index.html:2580
  parts.cover.style.display = "none";

  // SOURCE: index.html:2582-2584
  const projList = parts.projects;
  if (projList) {
    projList.style.display = "";
    // SOURCE: index.html:2585-2590
    projList.cards().forEach((card, i) => {
      card.classList.remove("fly-in");
      void card.offsetWidth;
      card.style.animationDelay = (i * 0.08) + "s";
      card.classList.add("fly-in");
    });
  }
};

// SOURCE: index.html:2604-2614
export const resetCategory: ResetCategory = (parts: CoverParts): void => {
  // SOURCE: index.html:2606-2607
  if (parts.projects) parts.projects.style.display = "none";

  // SOURCE: index.html:2608
  parts.cover.style.display = "";

  // SOURCE: index.html:2609
  parts.cover.dataset.done = "";

  // SOURCE: index.html:2610
  const cta = parts.cta;
  if (cta) cta.style.opacity = "";

  // SOURCE: index.html:2611
  const bomb = parts.bomb;
  if (bomb) bomb.style.opacity = "";

  // SOURCE: index.html:2612-2613
  const countdownEl = parts.countdown;
  if (countdownEl) {
    countdownEl.classList.remove("show", "pulse");
  }
};

// SOURCE: index.html:2620-2629
export const mountSectionReset: MountSectionReset = (env) => {
  const observer = env.createObserver((entries) => {
    // SOURCE: index.html:2621-2627
    entries.forEach((entry) => {
      const section = env.sections.find((candidate) => candidate.target === entry.target);
      if (!section) return;

      const parts = section.parts;
      if (!parts) return;

      // SOURCE: index.html:2623
      if (!parts.cover.dataset.done) return;

      // SOURCE: index.html:2624-2626
      if (!entry.isIntersecting && entry.boundingClientRect.top > 0) {
        resetCategory(parts);
      }
    });
  }, { threshold: 0 });

  // SOURCE: index.html:2629
  env.sections.forEach((section) => observer.observe(section.target));

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    observer.disconnect();
  };
};
