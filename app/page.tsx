import { redirect } from "next/navigation";
import { DEFAULT_LANG } from "@/lib/content";

export default function Root() { redirect(`/${DEFAULT_LANG}`); }
