// Friendly Arabic admin for a non-technical owner. Everything is done with buttons: no URLs, ids or JSON.
"use client";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import type { LText, MediaSlot } from "@/lib/content";
import { HttpAdminApi, AdminApiError, type AdminApi } from "@/lib/admin/api";
import { ADMIN_API_BASE, readToken, saveToken } from "@/lib/admin/config";
import { validateLText, safeUrl, validKey } from "@/lib/admin/validate";
import { inferFields, validateItem, blankItem, kindForItem, type Item, type Field } from "@/lib/admin/schema";
import { syncCollection, moveItem, newId, diffCollection, isEmptyOps } from "@/lib/admin/diff";
import { checkUpload, collectionLabel, fieldLabel, friendlyError, hiddenField, itemTitle, mediaLabel, textGroup, uploadKindForField, DEFAULT_MAX_UPLOAD_MB, type UploadKind } from "@/lib/admin/upload";

export interface AdminData { texts: Record<string, LText>; media: Record<string, MediaSlot>; collections: Record<string, Item[]> }
type Tab = "texts" | "media" | "collections";
type Status = { kind: "ok" | "err"; msg: string } | null;
const TAB_AR: Record<Tab, string> = { media: "الصور والفيديو", collections: "الأعمال والمحتوى", texts: "النصوص" };
const MAX_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || DEFAULT_MAX_UPLOAD_MB;

function LTextInput({ value, onChange }: { value: LText; onChange: (v: LText) => void }) {
  return (
    <div className="adm-ltext">
      <textarea dir="rtl" lang="ar" value={value.ar} placeholder="بالعربي" onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ ...value, ar: e.target.value })} aria-label="بالعربي" />
      <textarea dir="ltr" lang="en" value={value.en ?? ""} placeholder="English (اختياري)" onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ ar: value.ar, ...(e.target.value ? { en: e.target.value } : {}) })} aria-label="English" />
    </div>
  );
}

function Preview({ url, kind }: { url: string; kind: UploadKind }) {
  if (!url) return <div className="adm-empty">لا يوجد ملف بعد</div>;
  return kind === "video"
    ? <video className="adm-prev" src={url} controls preload="metadata" muted playsInline />
    : <img className="adm-prev" src={url} alt="" />;
}

/** One button that picks a file, uploads it with a progress bar, and hands back the new URL. */
function UploadField({ kind, url, api, disabled, onUploaded, label }: {
  kind: UploadKind; url: string; api: AdminApi | null; disabled: boolean; label: string; onUploaded: (url: string) => void | Promise<void>;
}) {
  const [pct, setPct] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const uploading = pct !== null;
  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f || !api) return;
    const bad = checkUpload(f, kind, MAX_MB);
    if (bad) { setMsg({ ok: false, text: bad }); return; }
    setMsg(null); setPct(0);
    try {
      const r = api.uploadWithProgress ? await api.uploadWithProgress(f, f.name, setPct) : await api.uploadMedia(f, f.name);
      await onUploaded(r.url);
      setMsg({ ok: true, text: "تم الرفع. اضغط «حفظ» لتثبيت التغيير." });
    } catch (err) { setMsg({ ok: false, text: friendlyError(err instanceof AdminApiError ? err.status : null, (err as Error).message) }); }
    finally { setPct(null); }
  }
  return (
    <div className="adm-upload">
      <Preview url={url} kind={kind} />
      <label className={`adm-btn${disabled || uploading ? " is-off" : ""}`}>
        {uploading ? "جارٍ الرفع…" : label}
        <input type="file" hidden disabled={disabled || uploading} accept={kind === "video" ? "video/mp4,video/webm" : "image/jpeg,image/png,image/webp,image/gif"} onChange={pick} />
      </label>
      {uploading && <div className="adm-progress" role="progressbar" aria-valuenow={Math.round((pct ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.round((pct ?? 0) * 100)}%` }} /><span>{Math.round((pct ?? 0) * 100)}%</span></div>}
      {uploading && <small className="adm-hint">لا تغلق الصفحة حتى ينتهي الرفع.</small>}
      {msg && <small className={msg.ok ? "adm-ok" : "adm-err"} role="status">{msg.text}</small>}
      <small className="adm-hint">الحد الأقصى {MAX_MB} ميغا.</small>
    </div>
  );
}

export default function AdminApp({ data }: { data: AdminData }) {
  const [tab, setTab] = useState<Tab>("media");
  const [token, setToken] = useState<string>(""); // same on server and first client render (no hydration mismatch)
  const [showToken, setShowToken] = useState(false);
  const [conn, setConn] = useState<"unknown" | "ok" | "bad">("unknown");
  useEffect(() => { setToken(readToken() ?? ""); }, []);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [texts, setTexts] = useState(data.texts);
  const [media, setMedia] = useState(data.media);
  const [saved, setSaved] = useState(data.collections);
  const [cols, setCols] = useState(data.collections);
  const [colName, setColName] = useState(data.collections.works ? "works" : Object.keys(data.collections)[0] ?? "");
  const [textKeys] = useState(() => Object.keys(data.texts));
  const [q, setQ] = useState("");

  const api: AdminApi | null = useMemo(() => (ADMIN_API_BASE ? new HttpAdminApi(ADMIN_API_BASE, () => token || null) : null), [token]);
  const disabled = !api || busy;
  useEffect(() => { setConn("unknown"); }, [token]);

  async function checkConn() {
    if (!api?.checkAuth) return;
    try { await api.checkAuth(); setConn("ok"); setStatus(null); }
    catch (e) { setConn("bad"); setStatus({ kind: "err", msg: friendlyError(e instanceof AdminApiError ? e.status : null, (e as Error).message) }); }
  }
  const [pub, setPub] = useState<{ state: string; message: string } | null>(null);
  useEffect(() => {
    if (pub?.state !== "running" || !api?.publishStatus) return;
    const t = setInterval(async () => { try { const st = await api.publishStatus!(); setPub(st); } catch { /* keep polling */ } }, 3000);
    return () => clearInterval(t);
  }, [pub?.state, api]);
  async function publish() {
    if (!api?.publish) return;
    setPub({ state: "running", message: "جاري البدء…" });
    try { await api.publish(); } catch (e) { setPub({ state: "error", message: e instanceof AdminApiError && e.status === 409 ? "عملية نشر جارية بالفعل." : e instanceof AdminApiError && e.status === 501 ? "النشر غير مفعّل على هذا السيرفر." : friendlyError(e instanceof AdminApiError ? e.status : null, (e as Error).message) }); }
  }
  async function run(label: string, fn: (a: AdminApi) => Promise<void>) {
    if (!api) { setStatus({ kind: "err", msg: "السيرفر غير مربوط بالموقع، لذلك لا يمكن الحفظ الآن." }); return; }
    setBusy(true); setStatus(null);
    try { await fn(api); setStatus({ kind: "ok", msg: `تم الحفظ: ${label}` }); }
    catch (e) { setStatus({ kind: "err", msg: `${label}: ${friendlyError(e instanceof AdminApiError ? e.status : null, (e as Error).message)}` }); }
    finally { setBusy(false); }
  }

  const fields: Field[] = useMemo(() => inferFields(cols[colName] ?? []).filter((f) => !hiddenField(colName, f.name)), [cols, colName]);
  const items = cols[colName] ?? [];
  const errors = useMemo(() => new Map(items.map((it) => [it.id, validateItem(colName, inferFields(cols[colName] ?? []), it)])), [items, cols, colName]);
  const hasErrors = [...errors.values()].some((e) => e.length);
  const ops = diffCollection(saved[colName] ?? [], items);
  const dirty = !isEmptyOps(ops);
  const catOptions = (cols["works.categories"] ?? []).map((c) => ({ id: c.id, label: itemTitle(c) }));

  const setItems = (next: Item[]) => setCols({ ...cols, [colName]: next });
  const edit = (id: string, name: string, v: unknown) => setItems(items.map((it) => (it.id === id ? { ...it, [name]: v } : it)));

  const groups = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const k of textKeys) { if (q && !k.includes(q) && !(texts[k]?.ar ?? "").includes(q) && !(texts[k]?.en ?? "").toLowerCase().includes(q.toLowerCase())) continue; const g = textGroup(k); m.set(g, [...(m.get(g) ?? []), k]); }
    return [...m.entries()];
  }, [textKeys, texts, q]);

  return (
    <div className="adm" dir="rtl" lang="ar">
      <header className="adm-head">
        <h1>لوحة التحكم</h1>
        <div className="adm-pass">
          <label>كلمة السر
            <input type={showToken ? "text" : "password"} value={token} autoComplete="off" onChange={(e: ChangeEvent<HTMLInputElement>) => { setToken(e.target.value); saveToken(e.target.value); }} />
          </label>
          <button type="button" onClick={() => setShowToken(!showToken)}>{showToken ? "إخفاء" : "إظهار"}</button>
          <button type="button" onClick={checkConn} disabled={!api || !token}>تحقق</button>
          {conn === "ok" && <span className="adm-ok">✓ متصل</span>}
        </div>
        <nav role="tablist">{(["media", "collections", "texts"] as Tab[]).map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{TAB_AR[t]}</button>)}</nav>
      </header>
      {!ADMIN_API_BASE && <p className="adm-warn" role="alert">السيرفر غير مربوط بالموقع، فالصفحة للعرض فقط ولا يمكن الحفظ.</p>}
      {ADMIN_API_BASE && !token && <p className="adm-warn">اكتب كلمة السر في الأعلى ثم اضغط «تحقق» قبل أي تعديل.</p>}
      {ADMIN_API_BASE && token && process.env.NEXT_PUBLIC_ENABLE_PUBLISH === "1" && (
        <div className="adm-publish">
          <button type="button" className="adm-primary" disabled={disabled || pub?.state === "running"} onClick={publish}>{pub?.state === "running" ? "جاري النشر…" : "انشر التعديلات على الموقع"}</button>
          <small className="adm-hint">احفظ تعديلاتك أولاً، ثم اضغط هنا لتظهر للزوار. يستغرق عدة دقائق (تُضغط الفيديوهات الكبيرة تلقائياً). لا تُطفئ الجهاز أثناء ذلك.</small>
          {pub && pub.state !== "idle" && <p className={pub.state === "error" ? "adm-err adm-banner" : "adm-ok adm-banner"} role="status">{pub.state === "done" ? "✓ " : ""}{pub.message}</p>}
        </div>
      )}
      {status && <p className={status.kind === "ok" ? "adm-ok adm-banner" : "adm-err adm-banner"} role="status">{status.msg}</p>}

      {tab === "media" && (
        <section>
          <p className="adm-lead">غيّر الصور والفيديوهات الأساسية للموقع. اختر الملف وسيُرفع ويُحفظ مباشرة.</p>
          {Object.entries(media).map(([k, m]) => {
            const bad = !safeUrl(m.url);
            return (
              <div className="adm-row" key={k}>
                <h3>{mediaLabel(k)}</h3>
                <UploadField kind={m.type === "video" ? "video" : "image"} url={m.url} api={api} disabled={disabled} label={m.type === "video" ? "اختر فيديو" : "اختر صورة"}
                  onUploaded={async (url) => { const next = { ...m, url }; setMedia((cur) => ({ ...cur, [k]: next })); if (api) await api.putMedia(next); setStatus({ kind: "ok", msg: `تم الحفظ: ${mediaLabel(k)}` }); }} />
                {m.type === "image" && (
                  <label className="adm-field">وصف الصورة (اختياري، للقارئ الصوتي)
                    <span className="adm-inline">
                      <input value={m.alt ?? ""} onChange={(e: ChangeEvent<HTMLInputElement>) => setMedia({ ...media, [k]: { ...m, alt: e.target.value } })} />
                      <button type="button" disabled={disabled || bad} onClick={() => run(mediaLabel(k), (a) => a.putMedia(m))}>حفظ الوصف</button>
                    </span>
                  </label>
                )}
              </div>
            );
          })}
        </section>
      )}

      {tab === "collections" && (
        <section>
          <label className="adm-field">اختر القسم
            <select value={colName} onChange={(e: ChangeEvent<HTMLSelectElement>) => setColName(e.target.value)}>{Object.keys(cols).map((n) => <option key={n} value={n}>{collectionLabel(n)}</option>)}</select>
          </label>
          {dirty && <p className="adm-warn" role="status">لديك تعديلات غير محفوظة. اضغط «حفظ التغييرات» في الأسفل.</p>}
          {items.map((it, i) => (
            <fieldset className="adm-item" key={it.id}>
              <legend>{itemTitle(it)}</legend>
              {fields.map((f) => {
                const kind = kindForItem(colName, f, it), v = it[f.name], err = errors.get(it.id)?.find((e) => e.field === f.name);
                const up = uploadKindForField(colName, f.name);
                return (
                  <div key={f.name} className="adm-field">
                    <span>{fieldLabel(f.name)}</span>
                    {up ? <UploadField kind={up} url={(v as string | null) ?? ""} api={api} disabled={disabled} label={up === "video" ? "اختر فيديو" : "اختر صورة"} onUploaded={(url) => edit(it.id, f.name, url)} />
                      : colName === "works" && f.name === "category" ? (
                        <select value={String(v ?? "")} onChange={(e: ChangeEvent<HTMLSelectElement>) => edit(it.id, f.name, e.target.value)}>
                          {catOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                          {!catOptions.some((c) => c.id === v) && <option value={String(v ?? "")}>{String(v ?? "")}</option>}
                        </select>)
                      : kind === "ltext" ? <LTextInput value={(v as LText | null) ?? { ar: "" }} onChange={(nv) => edit(it.id, f.name, f.nullable && !nv.ar && !nv.en ? null : nv)} />
                      : kind === "number" ? <input type="number" value={Number(v ?? 0)} onChange={(e: ChangeEvent<HTMLInputElement>) => edit(it.id, f.name, e.target.value === "" ? NaN : Number(e.target.value))} />
                      : <input value={(v as string | null) ?? ""} onChange={(e: ChangeEvent<HTMLInputElement>) => edit(it.id, f.name, f.nullable && e.target.value === "" ? null : e.target.value)} />}
                    {err && <small className="adm-err">{err.message === "required" ? "هذا الحقل مطلوب" : "قيمة غير صحيحة"}</small>}
                  </div>
                );
              })}
              <div className="adm-actions">
                <button type="button" onClick={() => setItems(moveItem(items, it.id, -1))} disabled={i === 0} aria-label="تحريك للأعلى">↑ أعلى</button>
                <button type="button" onClick={() => setItems(moveItem(items, it.id, 1))} disabled={i === items.length - 1} aria-label="تحريك للأسفل">↓ أسفل</button>
                <button type="button" onClick={() => { if (window.confirm(`حذف «${itemTitle(it)}»؟`)) setItems(items.filter((x) => x.id !== it.id)); }}>حذف</button>
              </div>
            </fieldset>
          ))}
          <div className="adm-actions adm-sticky">
            <button type="button" onClick={() => setItems([...items, blankItem(inferFields(items), newId(colName.split(".").pop()!.slice(0, 1), items.map((x) => x.id)))])}>+ إضافة جديد</button>
            <button type="button" className="adm-primary" disabled={disabled || hasErrors || !dirty}
              onClick={() => run(collectionLabel(colName), async (a) => { const r = await syncCollection(a, colName, saved[colName] ?? [], items); setSaved({ ...saved, [colName]: items }); if (r.done !== r.total) throw new Error("لم تكتمل كل التعديلات"); })}>
              حفظ التغييرات{dirty ? ` (${ops.puts.length + ops.deletes.length + (ops.reorder ? 1 : 0)})` : ""}
            </button>
            {hasErrors && <small className="adm-err">أصلح الحقول المعلّمة قبل الحفظ.</small>}
          </div>
        </section>
      )}

      {tab === "texts" && (
        <section>
          <input type="search" placeholder="ابحث في النصوص…" value={q} onChange={(e: ChangeEvent<HTMLInputElement>) => setQ(e.target.value)} aria-label="بحث" />
          {groups.map(([g, keys]) => (
            <details key={g} open={!!q}>
              <summary>{g} ({keys.length})</summary>
              {keys.map((k) => {
                const err = !validKey(k) ? "مفتاح غير صالح" : validateLText(texts[k]) ? "نص غير صالح" : null;
                return (
                  <div className="adm-row" key={k}>
                    <LTextInput value={texts[k]} onChange={(v) => setTexts({ ...texts, [k]: v })} />
                    {err && <small className="adm-err">{err}</small>}
                    <div className="adm-actions"><button type="button" disabled={disabled || !!err} onClick={() => run("النص", (a) => a.putText(k, texts[k]))}>حفظ هذا النص</button><code>{k}</code></div>
                  </div>
                );
              })}
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
