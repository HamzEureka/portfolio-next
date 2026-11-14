"""Builds content/seed.json from the v4 site (content.json + hard-coded HTML text) and the i18n dictionary.
Usage: python3 -I scripts/build_seed.py <v4-site-dir> <out.json>
Every text gets {ar, en}. en comes from js/i18n.js (exact, or prefix keys ending in the ellipsis char). Missing -> reported."""
import json, re, sys
site, out = sys.argv[1], sys.argv[2]
C = json.load(open(f"{site}/content.json", encoding="utf8"))
src = open(f"{site}/js/i18n.js", encoding="utf8").read()
pairs = re.findall(r'\["((?:[^"\\]|\\.)*)","((?:[^"\\]|\\.)*)"\]', src)
norm = lambda s: re.sub(r"\s+", " ", s).strip()
dec = lambda s: json.loads('"' + s + '"')
exact, pref = {}, []
for a, b in pairs:
    a, b = dec(a), dec(b)
    if a.endswith("…"): pref.append((norm(a[:-1]), b))
    else: exact[norm(a)] = b
missing = []
def L(ar, key, translate=True):
    en = None
    if translate:
        n = norm(ar)
        en = exact.get(n)
        if en is None:
            for p, e in pref:
                if n.startswith(p): en = e; break
        if en is None: missing.append(key)
    d = {"ar": ar}
    if en is not None: d["en"] = en
    return d
T = {}
def t(key, ar, translate=True): T[key] = L(ar, key, translate)
for k, v in [("about","نبذة"),("skills","المهارات"),("work","الأعمال"),("process","مسار العمل"),("contact","تواصل")]: t(f"nav.{k}", v)
t("nav.cta", "احكيلي عن مشروعك")
t("brand.name", "yossef salama", False)
t("splash.title", "PORTFOLIO", False); t("splash.name", "yossef salama", False); t("splash.role", "Video Editor", False)
for k in ["eyebrow","title","sub","cta1","cta2","counter"]: t(f"hero.{k}", C["hero"][k])
t("about.bgTextAr", "أهلاً أنا يوسف سلامة"); t("about.bgTextEn", "Video Editor", False)
t("skills.title", "الأدوات والمهارات"); t("skills.idx", "02 / المهارات")
t("works.title", "مختارات من الأعمال"); t("works.idx", "03 / الأعمال"); t("works.heading", "PORTFOLIO", False)
t("works.tag.default", "مشروع جديد"); t("works.liveTag", "LIVE PROJECT", False)
t("process.title", "مسار العمل معايا"); t("process.idx", "04 / آلية العمل")
t("testimonials.heading", "What Clients Are Saying", False)
t("review.cta.prompt", "جرّبت العمل مع يوسف؟"); t("review.cta.button", "أضف رأيك")
t("contact.eyebrow", "للتواصل"); t("contact.name", "يوسف سلامة"); t("contact.role", "Video Editor", False)
t("contact.share", "شارك البورتفوليو"); t("contact.thanks", "THANK YOU FOR YOUR TIME WATCHING", False)
for k, v in [("name","الاسم"),("email","البريد الإلكتروني"),("msg","تفاصيل المشروع"),("submit","إرسال الطلب")]: t(f"contactForm.{k}", v)
t("contactForm.ph.name", "اسمك بالكامل"); t("contactForm.ph.email", "you@example.com", False)
t("contactForm.ph.msg", "نوع الفيديو، المدة المتوقعة، وأي تفاصيل مهمة")
t("footer.copy", "© 2026 يوسف سلامة. جميع الحقوق محفوظة."); t("footer.tagline", "مصمم ومبني بعناية للمونتاج والسرد البصري")
t("brief.eyebrow", "طلب عرض سعر"); t("brief.title", "خليني أفهم مشروعك صح من أول مرة")
t("brief.sub", "كل ما التفاصيل اللي هتبعتها أوضح، كل ما هقدر أرد عليك بسعر ومدة تسليم أدق وأسرع.")
t("brief.submit", "إرسال الطلب عبر واتساب")
t("brief.submitNote", "هيفتحلك واتساب برسالة جاهزة فيها كل التفاصيل اللي كتبتها، تقدر تراجعها قبل ما تبعت.")
t("brief.error.required", "من فضلك املأ الاسم، رقم الواتساب، نوع المشروع، ومدة الفيديو على الأقل.")

for k, v in [
 ("common.close","\u0625\u063a\u0644\u0627\u0642"),
 ("brief.s1.title","\u0628\u064a\u0627\u0646\u0627\u062a\u0643"),("brief.s1.hint","\u0639\u0634\u0627\u0646 \u0623\u0642\u062f\u0631 \u0623\u0631\u062c\u0639\u0644\u0643 \u0628\u0633\u0631\u0639\u0629"),
 ("brief.f.name","\u0627\u0644\u0627\u0633\u0645 / \u0627\u0633\u0645 \u0627\u0644\u0634\u0631\u0643\u0629"),("brief.f.whatsapp","\u0631\u0642\u0645 \u0648\u0627\u062a\u0633\u0627\u0628 \u0644\u0644\u062a\u0648\u0627\u0635\u0644"),
 ("brief.s2.title","\u0646\u0648\u0639 \u0627\u0644\u0645\u0634\u0631\u0648\u0639"),("brief.s2.hint","\u0627\u062e\u062a\u0631 \u0627\u0644\u0623\u0642\u0631\u0628 \u0644\u0637\u0628\u064a\u0639\u0629 \u0627\u0644\u0641\u064a\u062f\u064a\u0648 \u0627\u0644\u0645\u0637\u0644\u0648\u0628"),
 ("brief.s3.title","\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0641\u064a\u062f\u064a\u0648"),("brief.s3.hint","\u0639\u0634\u0627\u0646 \u0623\u0642\u062f\u0631 \u0623\u062d\u0633\u0628 \u0627\u0644\u0648\u0642\u062a \u0648\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u0645\u0646\u0627\u0633\u0628\u064a\u0646"),
 ("brief.f.duration","\u0645\u062f\u0629 \u0627\u0644\u0641\u064a\u062f\u064a\u0648 \u0627\u0644\u0646\u0647\u0627\u0626\u064a \u0627\u0644\u0645\u062a\u0648\u0642\u0639\u0629"),("brief.ph.duration","\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u062f\u0629"),
 ("brief.f.count","\u0639\u062f\u062f \u0627\u0644\u0641\u064a\u062f\u064a\u0648\u0647\u0627\u062a \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629"),("brief.ph.count","\u0645\u062b\u0644\u0627\u064b: \u0641\u064a\u062f\u064a\u0648 \u0648\u0627\u062d\u062f\u060c \u0623\u0648 \u0633\u0644\u0633\u0644\u0629 \u0645\u0646 5"),
 ("brief.f.footage","\u0647\u0644 \u0627\u0644\u0645\u0627\u062f\u0629 \u0627\u0644\u062e\u0627\u0645 (\u062a\u0635\u0648\u064a\u0631/\u0635\u0648\u0631) \u062c\u0627\u0647\u0632\u0629 \u0639\u0646\u062f\u0643\u061f"),
 ("brief.f.platforms","\u0627\u0644\u0645\u0646\u0635\u0629 \u0623\u0648 \u0627\u0644\u0645\u0646\u0635\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u0647\u062f\u0641\u0629"),
 ("brief.f.ref","\u0645\u0631\u062c\u0639\u064a\u0629 \u0628\u0635\u0631\u064a\u0629 \u0623\u0648 \u0641\u064a\u062f\u064a\u0648\u0647\u0627\u062a \u0628\u062a\u062d\u0628\u0647\u0627 \u0643\u0633\u062a\u0627\u064a\u0644 (\u0631\u0648\u0627\u0628\u0637 \u0644\u0648 \u0645\u0648\u062c\u0648\u062f\u0629)"),
 ("brief.ph.ref","\u062d\u0637 \u0623\u064a \u0631\u0648\u0627\u0628\u0637 \u0641\u064a\u062f\u064a\u0648 \u0623\u0648 \u0623\u0645\u062b\u0644\u0629 \u0628\u062a\u062d\u0628 \u0627\u0644\u0633\u062a\u0627\u064a\u0644 \u0628\u062a\u0627\u0639\u0647\u0627"),
 ("brief.s4.title","\u0627\u0644\u0645\u064a\u0639\u0627\u062f \u0648\u0627\u0644\u0645\u064a\u0632\u0627\u0646\u064a\u0629"),("brief.s4.hint","\u062a\u0641\u0627\u0635\u064a\u0644 \u0645\u0647\u0645\u0629 \u0639\u0634\u0627\u0646 \u0623\u0642\u062f\u0631 \u0623\u062f\u064a\u0643 \u0633\u0639\u0631 \u0648\u0627\u0642\u0639\u064a"),
 ("brief.f.deadline","\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062a\u0633\u0644\u064a\u0645 \u0627\u0644\u0645\u0637\u0644\u0648\u0628"),("brief.f.budget","\u0627\u0644\u0645\u064a\u0632\u0627\u0646\u064a\u0629 \u0627\u0644\u062a\u0642\u0631\u064a\u0628\u064a\u0629 \u0627\u0644\u0645\u062a\u0627\u062d\u0629"),("brief.ph.budget","\u0627\u062e\u062a\u0631 \u0646\u0637\u0627\u0642 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)"),
 ("brief.f.notes","\u0623\u064a \u062a\u0641\u0627\u0635\u064a\u0644 \u0625\u0636\u0627\u0641\u064a\u0629 \u062d\u0627\u0628\u0628 \u062a\u0642\u0648\u0644\u0647\u0627"),("brief.ph.notes","\u0623\u064a \u062d\u0627\u062c\u0629 \u062a\u0627\u0646\u064a\u0629 \u062a\u062d\u0628 \u062a\u0636\u064a\u0641\u0647\u0627 \u0639\u0646 \u0627\u0644\u0645\u0634\u0631\u0648\u0639"),
]: t(k, v)
data = {"texts": T, "media": {}, "collections": {}}
M = data["media"]
def media(key, url, typ, alt=""): M[key] = {"id": key, "url": url, "type": typ, "alt": alt}
media("brand.logo", "/assets/logo.svg", "image", "yossef logo")
media("about.photo", "/assets/profile-photo.webp", "image"); media("contact.avatar", "/assets/profile-photo.webp", "image")
media("hero.poster", "/assets/hero-poster.jpg", "image"); media("hero.video", "/assets/hero-video.mp4", "video")
col = data["collections"]
col["about.paragraphs"] = [{"id": f"p{i+1}", "text": L(x, f"about.paragraphs.{i}")} for i, x in enumerate(C["about"]["paragraphs"])]
col["about.stats"] = [{"id": f"s{i+1}", "n": s["n"], "label": L(s["label"], f"about.stats.{i}.label")} for i, s in enumerate(C["about"]["stats"])]
col["skills"] = [
 {"id":"premiere","name":"Adobe Premiere Pro","percent":95,"badge":"Pr"},
 {"id":"aftereffects","name":"Adobe After Effects","percent":50,"badge":"Ae"},
 {"id":"capcut","name":"CapCut","percent":99,"icon":"capcut"},
 {"id":"canva","name":"Canva","percent":99,"icon":"canva"}]
col["works.categories"] = [{"id":"social","label":L("سوشيال ميديا","works.categories.social.label"),"cta":L("دوس هنا","works.categories.social.cta")}]
col["works"] = [{"id": f"work{i}", "category": "social", "order": i, "title": {"ar": str(i)}, "desc": {"ar": ""}, "tag": None, "video": f"/assets/project-{i}.mp4", "poster": None} for i in range(1, 5)]
col["process"] = [{"id": f"step{i+1}", "title": L(x["title"], f"process.{i}.title"), "text": L(x["text"], f"process.{i}.text")} for i, x in enumerate(C["process"])]
col["testimonials"] = [{"id": f"t{i+1}", "text": {"ar": x["text"]}, "name": {"ar": x["name"]}, "role": {"ar": x["role"]}} for i, x in enumerate(C["testimonials"])]
col["contact.links"] = [{"id": k, "value": C["contact"][k]} for k in ["email","whatsapp","instagram","facebook"]]

# brief options: value = Arabic string sent in the WhatsApp message (kept stable), label = display text
import html as _h
brief_src = open(f"{site}/index.html", encoding="utf8").read()
def chips(group_id=None, name=None):
    out = []
    pat = r'<input type="(?:radio|checkbox)"[^>]*?(?:name="%s")?[^>]*?value="([^"]*)"[^>]*><label[^>]*>([^<]*)</label>' % (name or "")
    return re.findall(r'<input type="(?:radio|checkbox)"[^>]*name="%s"[^>]*value="([^"]*)"[^>]*><label[^>]*>([^<]*)</label>' % name, brief_src) if name else []
def opts(sel_id):
    m = re.search(r'<select id="%s"[^>]*>(.*?)</select>' % sel_id, brief_src, re.S)
    return [(v, _h.unescape(l)) for v, l in re.findall(r'<option value="([^"]*)">([^<]*)</option>', m.group(1)) if v]
def plat():
    m = re.search(r'id="bf-platforms">(.*?)</div>\s*</div>\s*<div class="field">', brief_src, re.S)
    return re.findall(r'type="checkbox"[^>]*value="([^"]*)"[^>]*><label[^>]*>([^<]*)</label>', brief_src)
def mk(name, rows):
    col["brief." + name] = [{"id": f"{name}{i+1}", "value": v, "label": L(_h.unescape(l), f"brief.{name}.{i}")} for i, (v, l) in enumerate(rows)]
mk("projectTypes", chips(name="ptype")); mk("footage", chips(name="footage")); mk("platforms", plat())
mk("durations", opts("bf-duration")); mk("budgets", opts("bf-budget"))
for k in ["projectTypes","footage","platforms","durations","budgets"]: print(k, len(col["brief."+k]))
data["missingEnglish"] = missing
json.dump(data, open(out, "w", encoding="utf8"), ensure_ascii=False, indent=2)
print("texts:", len(T), "missing en:", missing)
