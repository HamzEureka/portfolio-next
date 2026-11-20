// STATUS: UNVERIFIED (Claude proposal). Minimal structural types so the v4 add-on logic can run against real DOM objects
// (cast with `as unknown as ...`, same pattern as lib/spotlight-ui/contract.ts) and against the fake DOM in tests.
export interface ClassListLike { add(...c: string[]): void; remove(...c: string[]): void }
export interface StyleLike { transform: string }
export interface ElLike {
  classList: ClassListLike;
  setAttribute(k: string, v: string): void;
  append(...n: unknown[]): void;
  prepend(...n: unknown[]): void;
  remove(): void;
  addEventListener(type: string, fn: (e: unknown) => void, opts?: unknown): void;
  removeEventListener?(type: string, fn: (e: unknown) => void, opts?: unknown): void;
}
export interface VideoLike extends ElLike { muted: boolean; play(): Promise<void>; pause(): void }
export interface DocLike { createElement(tag: string): ElLike }
export interface IOLike { observe(el: unknown): void; disconnect(): void }
export interface HeroEnv {
  doc: DocLike;
  matchMedia(q: string): { matches: boolean };
  navigator: { connection?: { saveData?: boolean; effectiveType?: string } };
  IntersectionObserver?: new (cb: (entries: Array<{ isIntersecting: boolean }>) => void) => IOLike;
}
