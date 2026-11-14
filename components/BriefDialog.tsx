"use client";
import { useEffect, useRef, useState } from "react";

export interface Opt { id: string; value: string; label: string }
export interface BriefProps {
  t: Record<string, string>;            // resolved texts, keys as in seed (brief.*, common.close)
  whatsapp: string;
  projectTypes: Opt[]; footage: Opt[]; platforms: Opt[]; durations: Opt[]; budgets: Opt[];
}

/** Brief dialog: same fields and WhatsApp message format as v4 (message lines stay Arabic by design). */
export default function BriefDialog(p: BriefProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    const open = () => { d.showModal(); document.documentElement.classList.add("modal-open"); };
    const on = (e: Event) => { e.preventDefault(); open(); };
    const trig = Array.from(document.querySelectorAll("[data-open-brief]"));
    trig.forEach((a) => a.addEventListener("click", on));
    if (location.hash === "#brief") open();
    const onClose = () => document.documentElement.classList.remove("modal-open");
    const onBackdrop = (e: MouseEvent) => { if (e.target === d) d.close(); };
    d.addEventListener("close", onClose); d.addEventListener("click", onBackdrop);
    return () => { trig.forEach((a) => a.removeEventListener("click", on)); d.removeEventListener("close", onClose); d.removeEventListener("click", onBackdrop); };
  }, []);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(false);
    const f = e.currentTarget, v = (n: string) => (f.elements.namedItem(n) as HTMLInputElement | null)?.value.trim() ?? "";
    const checked = (n: string) => f.querySelector<HTMLInputElement>(`input[name="${n}"]:checked`)?.value;
    const ptype = checked("ptype"), footage = checked("footage"), duration = v("duration");
    const platforms = Array.from(f.querySelectorAll<HTMLInputElement>('input[name="platform"]:checked')).map((i) => i.value);
    const name = v("name"), wa = v("whatsapp");
    if (!name || !wa || !ptype || !duration) { setErr(true); return; }
    const lines = ["طلب عرض سعر جديد", "", "الاسم: " + name, "واتساب: " + wa, "نوع المشروع: " + ptype, "مدة الفيديو: " + duration];
    if (v("count")) lines.push("عدد الفيديوهات: " + v("count"));
    if (footage) lines.push("المادة الخام: " + footage);
    if (platforms.length) lines.push("المنصات: " + platforms.join("، "));
    if (v("ref")) lines.push("مرجعية بصرية: " + v("ref"));
    if (v("deadline")) lines.push("تاريخ التسليم المطلوب: " + v("deadline"));
    if (v("budget")) lines.push("الميزانية التقريبية: " + v("budget"));
    if (v("notes")) lines.push("تفاصيل إضافية: " + v("notes"));
    window.open("https://wa.me/" + p.whatsapp.replace(/\D/g, "") + "?text=" + encodeURIComponent(lines.join("\n")), "_blank", "noopener");
  }

  const t = p.t;
  const chips = (opts: Opt[], type: "radio" | "checkbox", name: string) => opts.map((o) => (
    <div className="chip" key={o.id}><input type={type} name={name} id={`bf-${o.id}`} value={o.value} /><label htmlFor={`bf-${o.id}`}>{o.label}</label></div>
  ));
  return (
    <dialog className="sheet" id="briefDialog" aria-labelledby="briefTitle" ref={ref}>
      <div className="sheet-in">
        <div className="sheet-head">
          <div><div className="eyebrow-role">{t["brief.eyebrow"]}</div><h2 id="briefTitle">{t["brief.title"]}</h2></div>
          <button type="button" className="sheet-x" aria-label={t["common.close"]} onClick={() => ref.current?.close()}>✕</button>
        </div>
        <p className="sheet-sub">{t["brief.sub"]}</p>
        <form className="brief" id="briefForm" noValidate onSubmit={submit}>
          <div className="f-section">
            <h2>{t["brief.s1.title"]}</h2><p className="f-hint">{t["brief.s1.hint"]}</p>
            <div className="field-row">
              <div className="field"><label className="required" htmlFor="bf-name">{t["brief.f.name"]}</label><input type="text" id="bf-name" name="name" required /></div>
              <div className="field"><label className="required" htmlFor="bf-whatsapp">{t["brief.f.whatsapp"]}</label><input type="tel" id="bf-whatsapp" name="whatsapp" placeholder="+963xxxxxxxxx" required /></div>
            </div>
          </div>
          <div className="f-section">
            <h2 className="required">{t["brief.s2.title"]}</h2><p className="f-hint">{t["brief.s2.hint"]}</p>
            <div className="field"><div className="chip-group" id="bf-projectType">{chips(p.projectTypes, "radio", "ptype")}</div></div>
          </div>
          <div className="f-section">
            <h2>{t["brief.s3.title"]}</h2><p className="f-hint">{t["brief.s3.hint"]}</p>
            <div className="field-row">
              <div className="field"><label className="required" htmlFor="bf-duration">{t["brief.f.duration"]}</label>
                <select id="bf-duration" name="duration" required><option value="">{t["brief.ph.duration"]}</option>{p.durations.map((o) => <option key={o.id} value={o.value}>{o.label}</option>)}</select></div>
              <div className="field"><label htmlFor="bf-count">{t["brief.f.count"]}</label><input type="text" id="bf-count" name="count" placeholder={t["brief.ph.count"]} /></div>
            </div>
            <div className="field"><label>{t["brief.f.footage"]}</label><div className="radio-row chip-group">{chips(p.footage, "radio", "footage")}</div></div>
            <div className="field"><label>{t["brief.f.platforms"]}</label><div className="chip-group" id="bf-platforms">{chips(p.platforms, "checkbox", "platform")}</div></div>
            <div className="field"><label htmlFor="bf-ref">{t["brief.f.ref"]}</label><textarea id="bf-ref" name="ref" rows={3} placeholder={t["brief.ph.ref"]} /></div>
          </div>
          <div className="f-section">
            <h2>{t["brief.s4.title"]}</h2><p className="f-hint">{t["brief.s4.hint"]}</p>
            <div className="field-row">
              <div className="field"><label htmlFor="bf-deadline">{t["brief.f.deadline"]}</label><input type="date" id="bf-deadline" name="deadline" /></div>
              <div className="field"><label htmlFor="bf-budget">{t["brief.f.budget"]}</label>
                <select id="bf-budget" name="budget"><option value="">{t["brief.ph.budget"]}</option>{p.budgets.map((o) => <option key={o.id} value={o.value}>{o.label}</option>)}</select></div>
            </div>
            <div className="field"><label htmlFor="bf-notes">{t["brief.f.notes"]}</label><textarea id="bf-notes" name="notes" rows={4} placeholder={t["brief.ph.notes"]} /></div>
          </div>
          <div className="submit-bar" id="bfBar">
            {err && <p className="form-error" role="alert">{t["brief.error.required"]}</p>}
            <button type="submit" className="btn btn-primary">{t["brief.submit"]}</button>
            <span className="submit-note">{t["brief.submitNote"]}</span>
          </div>
        </form>
      </div>
    </dialog>
  );
}
