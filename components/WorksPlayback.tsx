// STATUS: UNVERIFIED (Claude draft; M5/T7; not compiled or rendered on the owner's machine)
"use client";
import { useEffect } from "react";
import { mountBrowserWorksPlayback } from "@/lib/works-ui/dom";

/** Renders nothing. Mounts the page-wide works playback controller (D19/D23) after the cards are in the DOM. */
export default function WorksPlayback() {
  useEffect(() => mountBrowserWorksPlayback(), []);
  return null;
}
