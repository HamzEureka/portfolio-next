// STATUS: UNVERIFIED (Claude draft; M4/T6; type-checked against lib.dom in the cloud sandbox, never run in a browser)
/**
 * DOM adapters for lib/works-ui/controller.ts. Client only: call from an effect, never during SSR.
 * Class names are the v4 markup of the category cover (`globals.css`, v4 index.html:1594-1626).
 */
import { createSounds } from "../works/sounds";
import { createExplosion } from "../works/explosion";
import { browserExplosionEnv, browserSoundsEnv, type AudioWindow } from "../works/browser";
import type { CoverParts, ExplosionTarget } from "../works/contract";
import { mountWorksController, type WorksController } from "./controller";
import { mountFillHeading } from "../works/fill-heading";
import { mountWorksPlayback } from "./playback";
import { WORKS_CLOSE_EVENT, cardIndexesOf } from "./events";
import type { CategoryAction } from "../works";

const q = <T extends HTMLElement>(root: ParentNode, sel: string): T | null => root.querySelector<T>(sel);

/** Resolves the pieces of one category from its `.category-section` element. Null when there is no cover. */
export function coverPartsFrom(section: HTMLElement): CoverParts | null {
  const cover = q<HTMLElement>(section, ".category-cover");
  if (!cover) return null;
  const stack = q<HTMLElement>(section, ".category-projects");
  return {
    cover,
    cta: q(cover, ".cat-cover-cta"),
    bomb: q(cover, ".cat-bomb"),
    countdown: q(cover, ".cat-countdown"),
    flash: q(cover, ".explosion-flash"),
    projects: stack ? { style: stack.style, cards: () => Array.from(stack.querySelectorAll<HTMLElement>(".stack-card")) } : null,
  };
}

/** `explode2D` read `cover.querySelector('.explosion-3d')` at call time; the getter keeps that. */
export function explosionTargetFrom(cover: HTMLElement): ExplosionTarget {
  return {
    getBoundingClientRect: () => cover.getBoundingClientRect(),
    get canvas() { return cover.querySelector(".explosion-3d"); },
  };
}

/** Builds the real controller for one category section. Returns null when the section has no cover (nothing to wire). */
export function mountBrowserWorksController(section: HTMLElement, dispatch: (a: CategoryAction) => void): WorksController | null {
  const parts = coverPartsFrom(section);
  if (!parts) return null;
  const win = window;
  return mountWorksController({
    section,
    parts,
    timers: { setTimeout: (fn, ms) => win.setTimeout(fn, ms), clearTimeout: (id) => win.clearTimeout(id) },
    sounds: createSounds(browserSoundsEnv(win as unknown as AudioWindow)),
    explosion: createExplosion(browserExplosionEnv(win, () => document.createElement("canvas"))),
    explosionTarget: explosionTargetFrom(parts.cover as HTMLElement),
    createObserver: (cb, init) => new IntersectionObserver((entries) => cb(entries), init),
    dispatch,
  });
}

// ---------- playback (T7) ----------

/** Mounts the page-wide playback controller over every `.stack-card` and listens for Close Category. Returns the teardown. */
export function mountBrowserWorksPlayback(): () => void {
  const els = Array.from(document.querySelectorAll<HTMLElement>(".stack-card"));
  const categoryOfCard = els.map((el) => el.closest<HTMLElement>(".category-projects")?.dataset.cat ?? "");
  const win = window;
  const pb = mountWorksPlayback({
    win: {
      get innerHeight() { return win.innerHeight; },
      addEventListener: (type, fn, opts) => win.addEventListener(type, fn, opts),
      removeEventListener: (type, fn) => win.removeEventListener(type, fn),
      setTimeout: (fn, ms) => win.setTimeout(fn, ms),
      clearTimeout: (id) => win.clearTimeout(id),
      requestAnimationFrame: (fn) => win.requestAnimationFrame(fn),
      cancelAnimationFrame: (id) => win.cancelAnimationFrame(id),
    },
    cards: els.map((el) => ({ getBoundingClientRect: () => el.getBoundingClientRect(), video: () => el.querySelector("video") })),
  });
  const onClose = (e: Event): void => {
    const category = (e as CustomEvent<{ category?: string }>).detail?.category;
    if (typeof category === "string") pb.closeCategory(cardIndexesOf(categoryOfCard, category));
  };
  win.addEventListener(WORKS_CLOSE_EVENT, onClose);
  return () => {
    win.removeEventListener(WORKS_CLOSE_EVENT, onClose);
    pb.dispose();
  };
}

// ---------- heading fill (T7b) ----------

/**
 * Wires lib/works/fill-heading.ts to `#portfolioFillHeading` (v4 index.html:2631-2659). Returns the teardown, or null when the
 * heading or its `.sfh-fill` is absent (v4 skipped the whole block). With prefers-reduced-motion nothing is mounted (CSS shows it filled).
 */
export function mountBrowserFillHeading(): (() => void) | null {
  const heading = document.getElementById("portfolioFillHeading");
  const fill = heading?.querySelector<HTMLElement>(".sfh-fill");
  if (!heading || !fill) return null;
  const win = window;
  return mountFillHeading({
    win: {
      get innerHeight() { return win.innerHeight; },
      addEventListener: (type, fn, opts) => win.addEventListener(type, fn, opts),
      removeEventListener: (type, fn) => win.removeEventListener(type, fn),
      setTimeout: (fn, ms) => win.setTimeout(fn, ms),
      clearTimeout: (id) => win.clearTimeout(id),
      requestAnimationFrame: (fn) => win.requestAnimationFrame(fn),
      cancelAnimationFrame: (id) => win.cancelAnimationFrame(id),
    },
    heading,
    fill,
    reduceMotion: win.matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
}
