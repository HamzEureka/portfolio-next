import { NextResponse } from "next/server";
import { LANG_COOKIE, pickLang, readCookie } from "@/lib/i18n";

export function GET(request: Request) {
  // Owner decision (2026-11-16): remember the visitor's choice (cookie set by LangSwitch), else the browser language, else DEFAULT_LANG. Changes D7.
  const lang = pickLang({
    cookie: readCookie(request.headers.get("cookie"), LANG_COOKIE),
    acceptLanguage: request.headers.get("accept-language"),
    useAcceptLanguage: true,
  });
  const res = NextResponse.redirect(new URL(`/${lang}`, request.url));
  res.headers.set("Vary", "Cookie, Accept-Language");
  return res;
}