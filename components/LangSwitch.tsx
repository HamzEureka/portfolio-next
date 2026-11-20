// STATUS: UNVERIFIED (Claude proposal; not type-checked against real @types/react / next)
"use client";
import { usePathname, useRouter } from "next/navigation";
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, otherLang, switchHref } from "@/lib/i18n";
import type { Lang } from "@/lib/content";

/** Language button: same markup/classes as the v5 button (`a.lang-btn`, label "EN" / "ar", D11), but keeps the sub-path and #hash
 *  and remembers the choice in a cookie. `labels[target]` is the aria-label (text keys lang.switchTo.*). */
export default function LangSwitch({ lang, labels }: { lang: Lang; labels: Record<Lang, string> }) {
  const pathname = usePathname() || `/${lang}`;
  const router = useRouter();
  const target = otherLang(lang);
  const href = switchHref(pathname, target);

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    const ev = e as unknown as { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; button: number; preventDefault(): void };
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;   // let the browser open a new tab
    ev.preventDefault();
    try { document.cookie = `${LANG_COOKIE}=${target}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; samesite=lax`; } catch { /* cookies blocked */ }
    router.push(href + window.location.hash);
  }

  return (
    <a href={href} className="lang-btn" aria-label={labels[target]} onClick={onClick}>
      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><circle cx={12} cy={12} r={9} /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></svg>
      <span>{target === "en" ? "EN" : "ar"}</span>
    </a>
  );
}
