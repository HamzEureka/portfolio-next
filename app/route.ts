import { NextResponse } from "next/server";
import { DEFAULT_LANG } from "@/lib/content";

export function GET(request: Request) {
  return NextResponse.redirect(
    new URL(`/${DEFAULT_LANG}`, request.url)
  );
}