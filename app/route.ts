import { LANG_COOKIE, pickLang, readCookie } from "@/lib/i18n";

export function GET(request: Request) {
  const lang = pickLang({
    cookie: readCookie(request.headers.get("cookie"), LANG_COOKIE),
    acceptLanguage: request.headers.get("accept-language"),
    useAcceptLanguage: true,
  });
  // رابط نسبي: خلف الوكيل يكون request.url هو العنوان الداخلي localhost:10000
  return new Response(null, { status: 307, headers: { Location: `/${lang}`, Vary: "Cookie, Accept-Language" } });
}
