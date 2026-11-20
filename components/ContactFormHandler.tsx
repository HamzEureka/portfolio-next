// STATUS: UNVERIFIED (Claude proposal; not type-checked against real @types/react). Adds the submit handler v4 never had, on the existing `.contact-form-wrap form`. POSTs to {API_BASE}/contact; with no server it says so, it never fakes success.
"use client";
import { useEffect } from "react";
import { API_BASE } from "@/lib/api-base";
import { submitContact, validateContact } from "@/lib/contact";

export default function ContactFormHandler({ t }: { t: Record<string, string> }) {
  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>(".contact-form-wrap form"); if (!form) return;
    const note = document.createElement("p"); note.className = "form-error"; note.setAttribute("role", "status"); note.hidden = true; form.appendChild(note);
    const show = (s: string, ok = false) => { note.textContent = s; note.hidden = false; note.style.color = ok ? "var(--accent-soft)" : ""; };
    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const onSubmit = async (e: Event) => {
      e.preventDefault(); note.hidden = true;
      const val = (id: string) => (form.querySelector<HTMLInputElement>("#" + id)?.value ?? "").trim();
      const p = { name: val("name"), email: val("email"), msg: val("msg"), website: "" };
      const bad = validateContact(p);
      if (bad) { show(t[bad === "name" ? "contactForm.errName" : bad === "email" ? "contactForm.errEmail" : "contactForm.errMsg"]); return; }
      if (submitBtn) submitBtn.disabled = true; show(t["contactForm.sending"], true);
      const o = await submitContact((u, i) => fetch(u, i) as never, API_BASE, p);
      if (submitBtn) submitBtn.disabled = false;
      if (o === "done") { form.reset(); show(t["contactForm.ok"], true); }
      else show(o === "invalid" ? t["contactForm.errMsg"] : o === "limited" ? t["contactForm.limited"] : t["contactForm.unavailable"]);
    };
    form.addEventListener("submit", onSubmit);
    return () => { form.removeEventListener("submit", onSubmit); note.remove(); };
  }, [t]);
  return null;
}
