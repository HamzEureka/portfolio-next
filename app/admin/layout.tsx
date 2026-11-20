// STATUS: UNVERIFIED (Claude proposal). Second root layout (own <html>): the public layout stays untouched.
import type { Metadata } from "next";
import "../globals.css";
import "./admin.css";

export const metadata: Metadata = { title: "لوحة التحكم", robots: { index: false, follow: false } };
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ar" dir="rtl" data-theme="dark"><body>{children}</body></html>;
}
