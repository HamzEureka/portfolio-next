// VERBATIM (TypeScript types removed, nothing else changed) from components/BriefDialog.tsx,
// function submit(e), as in the v6 project. Used only by tests/brief.test.ts.
// Injected: e (preventDefault, currentTarget = the form), p (props: only p.whatsapp is read),
// setErr, window (only window.open is called).
(function (e, p, setErr, window) {
    e.preventDefault(); setErr(false);
    const f = e.currentTarget, v = (n) => f.elements.namedItem(n)?.value.trim() ?? "";
    const checked = (n) => f.querySelector(`input[name="${n}"]:checked`)?.value;
    const ptype = checked("ptype"), footage = checked("footage"), duration = v("duration");
    const platforms = Array.from(f.querySelectorAll('input[name="platform"]:checked')).map((i) => i.value);
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
})
