import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LANGS, getStore, tr, type Lang } from "@/lib/content";
import "../globals.css";
import "../enhancements.css";
import "../skills.css";

export function generateStaticParams() { return LANGS.map((lang) => ({ lang })); }

const TITLE = { ar: "يوسف سلامة — مونتير فيديو", en: "Yousef Salama — Video Editor" };

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: TITLE[lang as Lang] ?? TITLE.ar };
}

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!LANGS.includes(lang as Lang)) notFound();
  return (
    <html lang={lang} dir={lang === "en" ? "ltr" : "rtl"}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@700&family=Bebas+Neue&family=Cairo:wght@600;700;800;900&family=Dancing+Script:wght@600;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
