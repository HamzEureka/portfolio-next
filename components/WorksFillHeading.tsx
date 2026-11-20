// STATUS: UNVERIFIED (Claude draft; M6/T7b; not compiled or rendered on the owner's machine)
"use client";
import { useEffect } from "react";
import { mountBrowserFillHeading } from "@/lib/works-ui/dom";

/** Renders nothing. Drives the clip-path of `#portfolioFillHeading .sfh-fill` on scroll (v4 heading fill). */
export default function WorksFillHeading() {
  useEffect(() => mountBrowserFillHeading() ?? undefined, []);
  return null;
}
