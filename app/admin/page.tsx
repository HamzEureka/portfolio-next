// STATUS: UNVERIFIED (Claude proposal). NO AUTH HERE: the server must enforce authorization on every write (Bearer token) and the host should protect /admin.
import { getStore } from "@/lib/content";
import AdminApp from "@/components/admin/AdminApp";
import type { Item } from "@/lib/admin/schema";

export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const s = await getStore();
  const names = ["about.paragraphs", "about.stats", "skills", "works.categories", "works", "process", "packages", "testimonials", "contact.links", "brief.projectTypes", "brief.footage", "brief.platforms", "brief.durations", "brief.budgets"] as const;
  const collections: Record<string, Item[]> = {};
  for (const n of names) collections[n] = (await s.list(n)) as unknown as Item[];
  return <AdminApp data={{ texts: await s.listTexts(), media: await s.listMedia(), collections }} />;
}
