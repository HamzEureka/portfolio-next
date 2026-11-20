// STATUS: UNVERIFIED (Claude proposal; not type-checked against real @types/react). v4 review dialog; classes/ids as in v4 (CSS already in globals.css).
"use client";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { Lang } from "@/lib/content";
import { API_BASE } from "@/lib/api-base";
import { REVIEW_MAX, reviewCount, reviewWhatsappHref, submitReview, validateReview, type ReviewPayload } from "@/lib/review";

export default function ReviewDialog({ t, whatsapp, lang }: { t: Record<string, string>; whatsapp: string; lang: Lang }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [len, setLen] = useState(0), [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null), [wa, setWa] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current, openBtn = document.getElementById("openReview"); if (!d || !openBtn) return;
    if (typeof HTMLDialogElement !== "function") { openBtn.hidden = true; return; }       // v4: canModal
    const open = () => { d.showModal(); document.documentElement.classList.add("modal-open"); };
    const onClose = () => document.documentElement.classList.remove("modal-open");
    const onBackdrop = (e: MouseEvent) => { if (e.target === d) d.close(); };
    openBtn.addEventListener("click", open); d.addEventListener("close", onClose); d.addEventListener("click", onBackdrop);
    return () => { openBtn.removeEventListener("click", open); d.removeEventListener("close", onClose); d.removeEventListener("click", onBackdrop); };
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg(null); setWa(null);
    const f = e.currentTarget, v = (id: string) => (f.elements.namedItem(id) as HTMLInputElement | null)?.value ?? "";
    const p: ReviewPayload = { name: v("name").trim(), role: v("role").trim(), text: v("text").trim(), website: v("website") };
    const bad = validateReview(p);
    if (bad) { setMsg({ text: t[bad === "name" ? "review.errName" : "review.errText"], ok: false }); return; }
    setBusy(true);
    const o = await submitReview((u, i) => fetch(u, i) as never, API_BASE, p);
    setBusy(false);
    if (o.kind === "done") { f.reset(); setLen(0); setMsg({ text: t["review.ok"], ok: true }); return; }
    if (o.kind === "problem") { setMsg({ text: o.status === 429 ? o.detail ?? t["review.limited"] : t["review.invalid"], ok: false }); return; }
    setMsg({ text: t["review.fallback"], ok: false }); setWa(reviewWhatsappHref(whatsapp, p, lang));
  }

  return (
    <dialog className="sheet" id="reviewDialog" aria-labelledby="reviewTitle" ref={ref}>
      <div className="sheet-in">
        <div className="sheet-head">
          <div><div className="eyebrow-role">{t["review.eyebrow"]}</div><h2 id="reviewTitle">{t["review.title"]}</h2></div>
          <button type="button" className="sheet-x" aria-label={t["common.close"]} onClick={() => ref.current?.close()}>✕</button>
        </div>
        <form className="brief" id="reviewForm" noValidate onSubmit={submit}>
          <div className="field"><label className="required" htmlFor="rv-name">{t["review.name"]}</label><input type="text" id="rv-name" name="name" maxLength={60} autoComplete="name" /></div>
          <div className="field"><label htmlFor="rv-role">{t["review.role"]}</label><input type="text" id="rv-role" name="role" maxLength={80} placeholder={t["review.rolePh"]} /></div>
          <div className="field"><label className="required" htmlFor="rv-text">{t["review.text"]}</label>
            <textarea id="rv-text" name="text" rows={5} maxLength={REVIEW_MAX} placeholder={t["review.textPh"]} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setLen(e.target.value.length)} />
            <div className="rv-count mono" dir="ltr">{reviewCount(len)}</div></div>
          <input type="text" id="rv-website" name="website" className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          {msg && <p className="form-error" role="alert" style={{ color: msg.ok ? "var(--accent-soft)" : undefined }}>{msg.text}</p>}
          <div className="submit-bar">
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? t["review.sending"] : t["review.send"]}</button>
            {wa && <a className="btn btn-ghost" href={wa} target="_blank" rel="noopener">{t["review.wa"]}</a>}
            <span className="submit-note">{t["review.note"]}</span>
          </div>
        </form>
      </div>
    </dialog>
  );
}
