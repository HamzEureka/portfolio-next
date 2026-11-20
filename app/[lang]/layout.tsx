import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import { LANGS, getStore, tr, type Lang } from "@/lib/content";
import { dirOf } from "@/lib/i18n";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "../globals.css";
import "../enhancements.css";
import "../skills.css";
import "../theme-portal.css"; // redesign: green portal theme (overrides tokens only)
import "../ltr-overrides.css"; // v8: LTR-only fixes, must stay the last stylesheet

export function generateStaticParams() { return LANGS.map((lang) => ({ lang })); }

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = LANGS.includes(lang as Lang) ? (lang as Lang) : "ar";
  const s = await getStore();
  return { title: tr(await s.getText("meta.title"), l) };
}

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!LANGS.includes(lang as Lang)) notFound();
  return (
    <html lang={lang} dir={dirOf(lang as Lang)} data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@700&family=Bebas+Neue&family=Cairo:wght@600;700;800;900&family=Dancing+Script:wght@600;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        {children}
      </body>
    </html>
  );
}
