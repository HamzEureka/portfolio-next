# SUMMARY.md — حالة `portfolio-next` عند التسليم

آخر تحديث: 2026-11-14. المصدر الأصلي للمقارنة: `yousef-portfolio-v4.zip`.
**الحالة الحالية:** الأساس v5 وv6a موجودان. إصلاح توجيه `/` عند commit `6593a24` موجود على GitHub ونجح GitHub Actions run `#2`. في جلسة التسليم 2026-11-14 طُبّقت حزمة التسليم النهائية على المجلد المحلي (أسماء الوسائط الموحّدة، وإصلاح مراجع الاختبار ومولّد seed)، ونجحت محلياً: `npm ci` و`npm run typecheck` و`npm test` (11/11) و`npm run verify:css` و`npm run build`. تعديلات جلسة التسليم دُفعت في commit `a2d5281` على `main`، ونجح GitHub Actions run `#3` (31 ثانية). الوسائط الستة (`logo.svg` و`profile-photo.webp` و`project-1..4.mp4`) موجودة محلياً في `public/assets/`، أما `hero-poster.jpg` و`hero-video.mp4` فنسختان فارغتان (0 بايت) بقرار صاحب المشروع. المراجعة البصرية أجراها صاحب المشروع وقيّمها «جيدة» باستثناء خلفية الـ hero (ملفان فارغان) وملاحظتين غير حرجتين (انظر Known gaps). بعد ذلك عُدّل المحتوى (زر اللغة `ar`، نص عربي بلهجة شامية، ميزانية بالدولار؛ القسم 14) ونجحت الفحوصات الأربعة محلياً بعد التعديل. قسم الآراء (v6b–v6e) مدموج في فرع `v6-testimonials` (91 اختباراً ناجحاً، ومراجعة بصرية بقائمة `qa/v6-checklist.md`) ويبقى دمجه في `main` عبر Pull Request بعد نجاح CI (القسم 15). الوسائط تبقى محلية ولا تُضمّن في الحزمة ولا تُرفع إلى GitHub.

## 1. حقائق من الفحص
- `site/index.html` ≈ 2950 سطراً: CSS مضمّن 1400 سطر (181 استخدام `var(--…)`، 18 media query، 12 keyframes)، ثم الماركب، ثم سكربتان مضمّنان (سطر 2124 وسطر 2836).
- ملفات خارجية: `js/content.js`, `js/site-data.js`, `js/i18n.js` (194 سطراً، قاموس بمفتاح = النص العربي), `js/enhancements.js` + `css/enhancements.css`, و`admin.*`.
- الألوان في `:root` (12 متغيراً): `--bg #141118`, `--bg-elev #1c1822`, `--bg-elev-2 #201b28`, `--text #f2eef8`, `--text-dim #b3a9c4`, `--text-faint #766b8a`, `--accent #a800f8`, `--accent-soft #c24dff`, `--accent-deep #6b4fa0`, `--line #332c40`, `--line-soft #241f2d`, `--radius 3px`.
- يوجد **34 لوناً حرفياً** خارج المتغيرات في CSS (أبرزها `#fff`, `#000`, `#160c22`, `rgba(168,0,248,.10)`) وألوان مضمّنة في المهارات (`--ti-a/--ti-b`). تحتاج توحيداً في المرحلة (القاعدة 3) دون ألوان جديدة.
- الربط الحالي بالمحتوى: `data-bind` (نص) و`data-bg` و`data-href` و`data-list`+`data-tpl`. مغطّى: hero، about، process، testimonials، contact.

## 2. جدول الجرد (الاسم الثابت ← القيمة الحالية)
### 2.1 نصوص (مصدرها `content.json` أو index.html)
| المفتاح | القيمة | المصدر |
|---|---|---|
| nav.about / skills / work / process / contact | نبذة / المهارات / الأعمال / مسار العمل / تواصل | HTML ثابت |
| nav.cta | احكيلي عن مشروعك | HTML ثابت |
| brand.name | yossef salama | HTML ثابت |
| splash.title / splash.name / splash.role | PORTFOLIO / yossef salama / Video Editor | HTML ثابت |
| hero.eyebrow | مونتير فيديو ومصمم موشن جرافيك | content.json |
| hero.title | الفيديو الحلو مش اللي اتصور كويس هو اللي اتمنتج صح | content.json |
| hero.sub | بستلم اللقطات الخام… من أول ثانية | content.json |
| hero.cta1 / hero.cta2 | اتفرج على الأعمال / احكيلي عن مشروعك | content.json |
| hero.counter | +20 مشروع مكتمل منذ 2025 | content.json |
| about.bgTextAr / about.bgTextEn | أهلاً أنا يوسف سلامة / Video Editor | HTML ثابت |
| about.paragraphs[0..2] | 3 فقرات | content.json |
| about.stats[0..2] (n,label) | 1 سنوات خبرة / 20+ مشروع منجز / 5+ عميل وعلامة تجارية | content.json |
| skills.title / skills.idx | الأدوات والمهارات / 02 / المهارات | HTML ثابت |
| skills.items[0..3] (name,percent,badge/icon) | Premiere Pro 95 (Pr) / After Effects 50 (Ae) / CapCut 99 (SVG) / Canva 99 (SVG) | HTML ثابت (غير موجودة في content.json) |
| works.title / works.idx / works.heading | مختارات من الأعمال / 03 / الأعمال / PORTFOLIO | HTML ثابت |
| works.categories[0] (id,label,cta) | social / سوشيال ميديا / دوس هنا | HTML ثابت |
| works.items[0..7] (title,desc,tag,video,poster) | انظر 2.2 | HTML ثابت |
| process.title وغيره | (القسم كله من `process[0..4]`: title,text) | content.json |
| testimonials.heading | What Clients Are Saying 🥰 | HTML ثابت |
| testimonials.items[0..3] (text,name,role) | 4 آراء (الأول والرابع للمعرّف نفسه، نص شبه مكرر) | content.json |
| review.cta.prompt / review.cta.button | جرّبت العمل مع يوسف؟ / أضف رأيك | HTML ثابت |
| contact.eyebrow / contact.name / contact.role | للتواصل / يوسف سلامة / Video Editor | HTML ثابت |
| contact.email / whatsapp / instagram / facebook | قيم في content.json؛ facebook = `https://www.facebook.com/` (عام، غير شخصي) | content.json |
| contact.share | شارك البورتفوليو | HTML ثابت |
| contact.thanks | THANK YOU FOR YOUR TIME WATCHING | HTML ثابت |
| contactForm.* (name,email,msg,labels,placeholders,submit) | 4 حقول + زر «إرسال الطلب» | HTML ثابت |
| footer.copy / footer.tagline | © 2026 يوسف سلامة… / مصمم ومبني بعناية… | HTML ثابت |
| brief.* (dialog) | عنوان، وصف، 4 أقسام، 7 أنواع مشاريع، 5 مدد، 3 حالات مادة، 5 منصات، 5 ميزانيات (بالجنيه)، ملاحظة الإرسال | HTML ثابت (قوائم خيارات تحتاج نموذج قائمة) |
| reviewForm.* | عنوان، 3 حقول، رسائل، ملاحظة | HTML ثابت |

### 2.2 الوسائط
| المفتاح | المسار الحالي | ملاحظة |
|---|---|---|
| brand.logo | assets/logo.svg | يُستعمل 3 مرات (nav, splash, footer), **غير موجود في zip** |
| about.photo | assets/profile-photo.webp | نفسه في contact.avatar. **غير موجود** |
| hero.poster / hero.video | assets/hero-poster.jpg / assets/hero-video.mp4 | عبر `data-*` على سكربت. **غير موجودة** |
| works.items[0..3].video | assets/PROJECT1..4.mp4 | poster فارغ. **غير موجودة** |
| works.items[4..7] | — | **حُسم:** العدد 4 فقط (PROJECT1..4)، وتُحذف البطاقات 5–8 (وملفات `im1.*` و`project6.mp4` المؤقتة). يُضاف المزيد من صفحة الإدارة لاحقاً (قرارك 2026-11-13 مساءً، يلغي «PROJECT1..6») |
| skills.items[2..3].icon | SVG مضمّن (CapCut, Canva) | يُستخرج لملفات SVG أو يبقى مكوّناً |

> ملاحظة (2026-11-14): أسماء `PROJECT1..4` وبقية المسارات في هذا الجدول هي أسماء v4 التاريخية. في مشروع Next تُعتمد أسماء lowercase-kebab-case داخل `public/assets/` (انظر القسم 13).

## 3. Known gaps
1. **ملفات الوسائط كلها غير موجودة** (يحتاج رفعها منك). لا يمكن التحقق بصرياً من المطابقة بدونها.
2. مسارات `im1.*` و`project6.mp4` و`profile-photo.webp` مؤقتة (تأكيد صاحب المشروع) وتُستبدل بـ `assets/PROJECT5.mp4` و`PROJECT6.mp4` للبطاقتين 5 و6. (حُسم: 4 بطاقات.)
3. بطاقات الأعمال: عناوين `1..8`، وصف فارغ، الوسم «مشروع جديد» للجميع.
4. قيمة `content.json` ≠ HTML الحالي في الحالات التالية فقط: لا فروق نصية وُجدت في الأقسام المغطّاة (تحقق سريع بالعين، لا آلي).
5. i18n بمفتاح = النص العربي (ينكسر مع التحرير) → D4.
6. عنوان `testimonials.heading` إنجليزي ثابت داخل صفحة عربية: يُنقل كما هو.
7. الرأيان 1 و4 لنفس الشخص بنص شبه مكرر؛ منقولان كما هما.
8. الألوان الحرفية الـ34 لم تُوحَّد بعد.
9. (أُنجز الآن، انظر 5–7.) بقي غير مفحوص بالتشغيل: سلوك السكربتات فعلياً في المتصفح.
11. رقم واتساب `963988311431` مكرر 4 مرات خارج `contact.whatsapp` (index سطر 1893 و2839، Brief سطر 350). يُوحَّد في v5.
12. اللون الحرفي `#ff7a8a` (خطأ النماذج) مضمّن في JS خارج متغيرات CSS.
13. نموذج «تواصل» في قسم contact (`#name,#email,#msg`) بلا معالج إرسال في السكربتات المفحوصة؛ يحتاج تحققاً قبل النقل.
10. **لم يُكتب أي كود Next.js، ولم يُنفَّذ أي تحقق بصري.**

## 4. قرارات تنتظرك (D1–D5)
| # | الخيارات | توصيتي (للمراجعة فقط) |
|---|---|---|
| D1 Router | App Router (الحالي في Next، Server Components، layouts) ↔ Pages Router (أبسط، أقدم، قد يُهمل) | App Router |
| D2 JS/TS | TypeScript (أنواع لنماذج CRUD، أخطاء أقل، عبء إعداد بسيط) ↔ JavaScript (أسرع لمن لا يعرف TS) | TypeScript |
| D3 نقل CSS | نسخ كما هو في `globals.css` واحد (أضمن مطابقة، أقل نظافة) ↔ CSS Modules لكل قسم (نظافة، لكن تقسيم يدوي يُخاطر بالمطابقة) | `globals.css` أولاً، وتقسيم لاحقاً |
| D4 اللغات | مسارات `/ar` `/en` مع محتوى `{ar,en}` لكل حقل ↔ لغة بالحالة/كوكي بلا مسارات | مسارات + حقول ثنائية اللغة (يحلّ كسر i18n الحالي) |
| D5 CRUD والوسائط | طبقة `lib/content` بواجهات list/get/create/update/delete تقرأ من JSON الآن وتُبدَّل بـ API لاحقاً؛ خانة وسائط = `{id,url,type,alt}` | كما وصفت |

## 5. جرد السكربتات المضمّنة في index.html (2124–2835 ثم 2836–2942)
السكربت الرئيسي ملفوف بـ `window.contentReady.then(...)`. الوحدات (تنتقل كلها إلى مكوّنات Client في Next):
| الوحدة | الوصف | يعتمد على |
|---|---|---|
| nav.toggle | قائمة الجوال `#navToggle`/`#navLinks` | DOM |
| hero.waveform | توليد أعمدة `.waveform` بمولّد عشوائي بذرة 7 | — |
| cursor | `#cursorDot` و`#cursorRing` متابع مؤشر/لمس، يحترم `prefers-reduced-motion` | — |
| reveal | IntersectionObserver على `.reveal` | — |
| skills | عدّاد النسبة 1400ms وعرض `.meter i` عند ظهور 40% | `data-percent` |
| stack.playback | يشغّل فيديو البطاقة المركّزة فقط (`STICKY_TOP=96`) ويوقف الباقي | `.stack-card` |
| category.detonation | عدّ تنازلي، أصوات (AudioContext: tick/boom)، جسيمات، دخان، وميض | `.category-cover` |
| explosion.canvas2d | انفجار Canvas 2D؛ **مكرر** مع نسخة في `enhancements.js` (تتجاوزها) → يُحسم في v7 | — |
| category.reveal/reset | إظهار `.category-projects` بعد الانفجار وإعادة الضبط عبر IntersectionObserver | `data-cat` |
| fillHeading | تعبئة عنوان PORTFOLIO مع التمرير | `#portfolioFillHeading` |
| testimonials | هجين: تلقائي على الجوال / بالتمرير على الحاسوب، نقاط تنقل (≈170 سطراً) | `#spotlightTrack`,`#spotlightDots` → v6 |
| modal.brief | `<dialog>`؛ فتح عبر `[data-open-brief]` أو `#brief`؛ تحقق (الاسم، الواتساب، النوع، المدة)؛ يبني رسالة ويفتح wa.me | `siteContent.contact.whatsapp` أو الافتراضي |
| modal.review | نموذج رأي؛ POST إلى `api/reviews`؛ 429/422؛ بديل واتساب عند غياب الخادم؛ حقل مصيدة `rv-website`؛ حد 500 حرف | الخادم (خارج النطاق) |
| share | `navigator.share` مع نسخ الرابط كبديل، رسالة «✓ تم النسخ» | — |
مفاتيح نصوص داخل JS تحتاج أسماء ثابتة: رسالة نقص الحقول، «جارٍ الإرسال…»، «إرسال الرأي»، رسائل نجاح/فشل المراجعة، «✓ تم النسخ»، نص المشاركة، قالب رسالة واتساب (أسطر «الاسم:», «واتساب:», …). لها مفاتيح مقترحة `msg.*` و`wa.template.*`.

`enhancements.js` (7.7KB): ثيم ليلي/نهاري (`portfolio-theme` في localStorage)، خلفية hero (`data-poster/data-video`)، شريط تقدم، انفجار Canvas (يتجاوز القديم) → v9.

## 6. قاموس الترجمة `i18n.js`
- 128 زوج (T نصوص + ATTR خصائص `placeholder/aria-label/title/alt`)، منها 22 مفتاح بادئة ينتهي بـ «…».
- آلية: TreeWalker + MutationObserver تبدّل نصوص العقد بمطابقة النص العربي (تطبيع المسافات). مفتاح اللغة `portfolio-lang`. يغيّر `html[lang,dir]`، ويضيف زر اللغة داخل `#navLinks`، ويطلق حدث `langchange`.
- يعرّض `window.siteLang.t()`.
- عنوان الصفحة: «يوسف سلامة — مونتير فيديو» ↔ Yousef Salama — Video Editor.
- الآراء وأسماء العملاء غير مترجمة عمداً.
- الخلاصة لـ D4: هذه الآلية لا تنتقل إلى Next كما هي؛ كل نص يصير حقلاً `{ar,en}` بمفتاحه الثابت. القاموس مصدر الإنجليزية الجاهز للترحيل (128 زوجاً) لكن مفاتيحه عربية فتُربط يدوياً بالمفاتيح الجديدة.

## 7. `Brief.html` (صفحة مستقلة)
- نسخة مطابقة تقريباً لنافذة `briefDialog` لكن بمعرّفات مختلفة (`name` بدل `bf-name`، `pt1` بدل `bf-pt1`...) وسكربتها الخاص و`WHATSAPP_NUMBER` ثابت.
- عنوان الصفحة: «طلب عرض سعر — يوسف سلامة مونتير فيديو»؛ h1: «خليني أفهم مشروعك صح من أول مرة».
- حقول: الاسم، واتساب، نوع المشروع (7)، المدة (5 + فارغ)، العدد، المادة الخام (3)، المنصات (5)، مرجعية، تاريخ التسليم، الميزانية (5 بالجنيه)، ملاحظات. زر: «إرسال الطلب عبر واتساب».
- المحتوى مكرر بين الملفين، فيُوحَّد في Next كمكوّن واحد تُبنى منه النافذة والصفحة `/brief` (يناسب v10) وقوائم الخياراته تُدار كبيانات (CRUD).

## 8. تنفيذ v5 (ما أُنجز فعلاً)
**القرارات:** D1 App Router · D2 TypeScript · D3 `globals.css` واحد ثم تقسيم لاحقاً · D4 مسارات `/ar` `/en` + حقول `{ar,en}` · D5 طبقة `lib/content` + خانة وسائط `{id,url,type,alt}`.
**الناتج:** `portfolio-next-v5.zip`.
- `app/globals.css`: نسخة من CSS v4 (sha256 `6e4c55d2…ff460`، 40,694 بايت) — تحقق ناجح عبر `scripts/verify_css.mjs`.
- `content/seed.json`: 74 نصاً `{ar,en}` + 5 وسائط + 13 مجموعة (فقرات، أرقام، مهارات، فئات، 4 أعمال، 5 خطوات، 4 آراء، روابط، وخيارات البريف الخمسة). الإنجليزية من قاموس v4 بلا نقص (`missingEnglish: []`)؛ الآراء والأسماء بلا ترجمة عمداً.
- `lib/content`: `ContentStore` (getText/setText/deleteText، getMedia/setMedia/deleteMedia، list/get/create/update/remove للمجموعات) + `MemoryStore` + قراءة/كتابة JSON.
- مكوّنات: الصفحة (كل الأقسام)، `Works` (فتح الستاك بنقرة)، `BriefDialog` (نفس حقول ورسالة واتساب v4)، `Effects` (قائمة الجوال، الموجة، الـ reveal، عدّاد المهارات).
- ألوان أيقونات المهارات انتقلت من inline إلى `app/skills.css` (نفس القيم، لا ألوان جديدة).

**ما تحقق منه فعلاً**
- 6 اختبارات لطبقة البيانات تنجح (`tsx --test`) وفحص أنواع `lib/` و`tests/` بلا أخطاء.
- فحص صياغة كل ملفات TSX ناجح، ورُسمت الصفحتان `/ar` و`/en` على الخادم (react-dom/server مع بدائل مؤقتة لـ next/link). مقارنة بـ index.html: 172 من 183 نصاً مطابقة؛ الباقي نموذج الرأي (غير منقول) وحرفا أفاتار الآراء. نفس الأصناف (classes) فيما عدا نموذج الرأي.
**لم يتحقق منه:** `next build`/`next dev`، فحص الأنواع للمكوّنات (لا @types/react)، المظهر في متصفح، RTL/LTR فعلياً، أداء.

## 9. Known gaps — الحالة الحالية عند التسليم

1. **المراجعة البصرية:** أجراها صاحب المشروع في المتصفح (2026-11-14) وقيّمها «جيدة»، لكنها غير مكتملة لخلفية الـ hero. الوسائط المحلية: `logo.svg` (578 بايت) و`profile-photo.webp` (62,740 بايت) و`project-1..4.mp4` (≈50 ميغابايت إجمالاً) موجودة في `public/assets/`. أما `hero-poster.jpg` و`hero-video.mp4` فنسختان فارغتان (0 بايت) بقرار صاحب المشروع، فلا يمكن مراجعة خلفية الـ hero بصرياً حتى تُستبدلا بالأصليين.
2. **Testimonials:** `lib/spotlight.ts` واختباراته موجودة، لكن لم يُربط بعد بمكوّن React. المرحلة التالية المقررة هي v6b، بعد مراجعة صاحب المشروع.
3. **سلوكيات لم تُنقل بعد** بحسب خطة المراحل: cursor، تشغيل فيديو البطاقة المركّزة، تأثيرات الفئات والانفجار، الثيم وخلفية hero وشريط التقدم، نموذج «أضف رأيك»، زر المشاركة، ومعالج نموذج «تواصل». راجع خريطة المراحل في `WORKFLOW.md`.
4. **صفحة `/brief`:** نافذة `#brief` موجودة، أما صفحة Brief المستقلة فمجدولة لـ v10.
5. **ملاحظات تطابق الأصل:** حرفا أفاتار الآراء قد يختلفان (`ن.ا` المولّد مقابل `ن.ع` الثابت في HTML). كما أن `desktopScrollTarget` في الحساب المنقول ينتج `NaN` عند `n = 1`؛ لا يؤثر ذلك على مجموعة الآراء الحالية ذات الأربعة عناصر، ويُراجع عند دمج v6b.
6. **ألوان CSS الحرفية:** بقيت كما في الأصل داخل `globals.css` حفاظاً على التطابق؛ توحيدها إلى متغيرات يحتاج قرار/مرحلة مستقلة ولا ينبغي تغييرها عشوائياً.
7. **التحقق البصري والمتصفح:** نجاح `next build` وCI لا يثبت وحده تطابق RTL/LTR أو سلوك اللمس والتمرير الفعلي؛ هذه مراجعة بشرية لاحقة.
8. **المحتوى والوسائط:** الوسائط تعيش في `public/assets/` فقط، وليس في جذر المشروع (Next.js لا يخدم إلا ما في `public/`، و`.gitignore` لا يحمي إلا `/public/assets/*`). في جلسة 2026-11-14 كانت الوسائط في `assets/` بجذر المشروع (غير متجاهَلة في Git) ثم نُقلت يدوياً إلى `public/assets/`، وأكّد `git status --ignored` أن Git يتجاهلها. فُحصت الأسماء والأحجام؛ لم تُفحص سلامة محتوى الفيديوهات ولا تشغيلها في المتصفح.
9. **BOM في ملفين:** `.gitattributes` و`.github/workflows/ci.yml` في حزمة التسليم يبدآن بعلامة BOM. لم يسبّب ذلك فشلاً (CI run #2 نجح)، ملاحظة شكلية تُعالج إن لزم.
10. **ملاحظتان من المراجعة البصرية (غير حرجتين بحسب صاحب المشروع، لم يُحقَّق في سببهما):** قسم الآراء يبقى بالعربية في `/ar` و`/en` (آراء العملاء غير مترجمة عمداً)، وقال صاحب المشروع إن الـ hero يبقى بالإنجليزية عند التبديل بين اللغتين.
11. **`scripts/build_seed.py` لم يعد مصدراً للنصوص:** `content/seed.json` هو المصدر الوحيد (D8). تشغيل المولّد سيمسح تعديلات اللهجة والدولار، ويحتاج أصلاً ملفات v4 غير الموجودة في المستودع.
12. **شرائح الميزانية بالدولار أرقام أولية** اقترحها Claude وقبلها صاحب المشروع كبداية؛ تُعدَّل في `content/seed.json` وفق تسعيره الفعلي.
13. **v6 (قسم الآراء) لم يُدمج في `main` بعد:** فُحصت `v6-merged.zip` ودُمجت في فرع `v6-testimonials` ونجحت الفحوصات (القسم 15)، ويبقى Pull Request وCI والدمج. مجلد `portfolio-next - Copy` نسخة تجريبية مطابقة للـ zip ولا يُعتمد عليه.
14. **بيانات الآراء:** نصوص الآراء وأسماؤها وأدوارها عربية فقط (بلا `en`)، والعنوان `What Clients Are Saying` مخزّن تحت المفتاح `ar` بنص إنجليزي. تُركا كما هما بقرار صاحب المشروع (D12)، وقد يربكان لوحة الإدارة في v11 (حقل «عربي» فيه نص إنجليزي)، وإضافة `en` لا تحتاج تعديل كود (`tr()` يعود إلى `ar` عند غيابه). كذلك قائمة `qa/v6-checklist.md` تتوقع آراء إنجليزية في `/en`، وهذا غير متطابق مع البيانات.

## 10. v6a (حسابات الآراء)
- `lib/spotlight.ts`: `mobileCardStyle`, `mobileActiveDot`, `mobileNext`, `mobileSwipe`, `desktopGap`, `desktopActiveFloat`, `desktopNearest`, `desktopCardStyle`, `desktopScrollTarget` وثوابت (`MOBILE_QUERY` 720px، الاستكمال 4500ms، عتبة السحب 40px، استئناف بعد النقر 3000ms).
- **تحقق فعلاً:** اختبارات التطابق مع كود v4 الأصلي (11 ناجحة مع اختبارات البيانات)، وفحص أنواع `lib/` و`tests/` نظيف، واختبار طفرة يؤكد أن الاختبارات تكشف تغيير معادلة أو عتبة.
- **لم يتحقق:** الاستخدام داخل React وسلوك المتصفح الفعلي (اللمس والتمرير الحقيقيان). لم يُربط الملف بأي مكوّن بعد.
- ملاحظة سلوك أصلي منقول كما هو: عند `n = 1` تُنتج `desktopScrollTarget` قيمة `NaN` (قسمة على `n-1`) كما في الأصل. لا يحدث مع 4 آراء، ويُعالَج في v6b إن لزم.
- ملاحظة: الأصل يخرج مبكراً ولا ينشئ النقاط عند `prefers-reduced-motion`، وهذا يخص v6b.


## 11. بيئة التطوير والتحقق والبناء

- المشروع: `portfolio-next`، الحزمة `yousef-portfolio@0.5.0`.
- بيئة الجهاز وقت آخر تحقق: Node.js `v24.19.0`، npm `12.2.1`.
- الإصدارات المثبتة في `package.json` والمتوافقة مع `package-lock.json`: Next.js `16.4.4`، React وReact DOM `19.3.1`، TypeScript `7.0.2`، tsx `4.23.15`، وملفات الأنواع كما في ملف القفل. هذه لقطة للإصدارات المقفلة وليست ادعاءً بأنها أحدث المتاح.
- التثبيت على النسخة النهائية: المستخدم نفّذ `npm ci` بنجاح؛ أضيفت 31 حزمة، وظهر `0 vulnerabilities`.
- فحص TypeScript على النسخة النهائية: المستخدم نفّذ `npm run typecheck`، وعاد إلى PowerShell دون رسائل أخطاء (`tsc --noEmit`).
- نتائج التحقق المحلي بتاريخ 2026-11-14 على النسخة النهائية (بعد مطابقة الملفات الأربعة وتعديل أسماء الوسائط)، كما أبلغ بها صاحب المشروع من جهازه:
  - `npm test`: 11 ناجحاً، 0 فشل (يشمل اختبار أسماء فيديوهات الأعمال الموحّدة).
  - `npm run verify:css`: `globals.css matches v4 CSS (sha256 ok)`.
  - `npm run build`: نجح (Next.js 16.4.4 Turbopack)؛ المسارات: `/` ديناميكي، `/ar` و`/en` ثابتان (SSG)، و`/_not-found`.
  - `npm run typecheck`: نجح بعد تعديل ملفي الأسماء.
  - `git diff --check`: لم يُشغَّل في هذه الجلسة.
- فروقات Git قبل الـ commit: `package.json` و`package-lock.json` تغيّرا باستبدال `"latest"` بإصدارات ثابتة فقط (16 سطراً في كل منهما، دون أي تغيير في `resolved`/`integrity`، أي بلا ترقية). في `content/seed.json` تغيّرت مسارات الوسائط فقط (مع سطر جديد في آخر الملف).
- إصلاح التوجيه: حُذف `app/page.tsx` وأُنشئ `app/route.ts` باستخدام `NextResponse.redirect` و`DEFAULT_LANG` من `@/lib/content`، وقيمته `ar`.
- Commit إصلاح التوجيه: `6593a24`; تم دفعه إلى `origin/main`.
- GitHub Actions run `#2` على commit `6593a24`: **Success** خلال 29 ثانية. هذا التشغيل يخص commit المذكور ولا يثبت أن تغييرات حزمة التسليم اللاحقة قد رُفعت.
- حالة Git قبل الـ commit (2026-11-14): الفرع `main` على `origin/main` حسب آخر مزامنة محلية (بلا ahead/behind). ثمانية ملفات معدّلة هي تغييرات الحزمة (`.gitignore`، `README.md`، `content/seed.json`، `package-lock.json`، `package.json`، `public/assets/README.txt`، `scripts/build_seed.py`، `tests/store.test.ts`) إضافة إلى `SUMMARY.md` و`WORKFLOW.md` غير المتتبَّعين. الوسائط الثمانية متجاهَلة (`!!`) ولا تظهر في الحالة.

## 12. Git history المختصر

- `bd17824` — `chore: initial baseline snapshot before v6b`، والوسم `v0.5.0`.
- `2aedcd2` — `ci: add GitHub Actions workflow with checkout@v7 and setup-node@v7.1.0`.
- `6593a24` — `fix(routing): handle root redirect with route handler`، موجود على `origin/main` وCI ناجح.

## 13. تحديث حزمة التسليم — 2026-11-14

### أسماء الوسائط المعتمدة
| الاستخدام | اسم الملف المحلي داخل `public/assets/` |
|---|---|
| الشعار | `logo.svg` |
| صورة About وصورة التواصل | `profile-photo.webp` |
| Hero poster | `hero-poster.jpg` |
| Hero video | `hero-video.mp4` |
| فيديوهات الأعمال | `project-1.mp4` إلى `project-4.mp4` |

تم تحديث المراجع في `content/seed.json` وملف تعليمات assets، ثم صُحّح مولّد seed واختباراته في النسخة النهائية لتستخدم أسماء الفيديوهات lowercase-kebab-case نفسها. أُعيدت تسمية الملفات المحلية بهذه الأسماء (2026-11-14)، مع بقاء `hero-poster.jpg` و`hero-video.mp4` فارغين (0 بايت).

### Git والاعتماديات
- `.gitignore` يستثني `/public/assets/*` مع إبقاء `public/assets/README.txt` متتبعًا. الوسائط لا تدخل ZIP ولا GitHub.
- تم تثبيت `package.json` على الإصدارات الموجودة فعليًا في `package-lock.json`، دون ترقية: Next 16.4.4، React 19.3.1، TypeScript 7.0.2، tsx 4.23.15، وملفات الأنواع وفق lockfile.
- تم تحديث `README.md`. المستخدم نفّذ `npm ci` بنجاح (31 حزمة، 0 vulnerabilities) و`npm run typecheck` دون أخطاء. ونجحت الفحوصات الأخرى على هذه النسخة (انظر القسم 11).
- ملفات الوسائط غير مضمنة عمدًا؛ المراجعة البصرية النهائية تتطلب وجودها محليًا.



### حالة Git عند التسليم
- آخر commit مؤكد على `origin/main`: `6593a24`.
- فُحصت فروقات حزمة التسليم (`git diff`) في جلسة التسليم. الـ commit والـ push خطوتان منفصلتان بموافقة صاحب المشروع، والحالة الفعلية في `git log`.
- لا تُرسل `node_modules/` أو `.next/` أو `.git/` أو ملفات `.env*` ضمن حزمة المشاركة.

## 14. تعديلات المحتوى — 2026-11-14

- **D8 — مصدر النصوص:** `content/seed.json` هو المصدر الوحيد. لا تُشغِّل `scripts/build_seed.py` لإعادة توليده.
- **D9 — اللهجة:** النص العربي الافتراضي بلهجة شامية تميل إلى السورية وخفيفة (مو، منشان، يضل، رح، فيك، شي). المفاتيح المعدّلة: `hero.title`، `hero.sub` («متل ما»)، `hero.cta1`، `process.title`، الخطوة الثالثة من `process`، `brief.sub`، `brief.submitNote`، `brief.s1.hint`، `brief.s3.hint`، `brief.s4.hint`، `brief.ph.ref`، `brief.ph.notes`، وخيارات `projectTypes7` و`durations5` و`platforms1` (انستغرام) و`platforms5` (تلفزيون). آراء العملاء (لهجة خليجية) ونصوص «نبذة» والقالب العربي لرسالة واتساب لم تُلمس. النصوص الإنجليزية لم تتغيّر إلا في تسميات الميزانية.
- **D10 — الميزانية بالدولار:** `10-30 دولار` و`30-70 دولار` و`70-150 دولار` و`أكثر من 150 دولار` و«محتاج استشارة الأول». الإنجليزية: `$10-$30` و`$30-$70` و`$70-$150` و`Over $150`. القيمة `value` المعدّلة هي التي تصل في رسالة واتساب. الأرقام أولية (انظر Known gaps).
- **D11 — زر اللغة:** يعرض `ar` بدل `ع` في الصفحة الإنجليزية، ويبقى `EN` في العربية (`app/[lang]/page.tsx`).
- **الاختبار:** `tests/store.test.ts` يتحقق من نص `hero.title` حرفياً؛ أي تغيير فيه يتطلب تحديث الاختبار.
- **التحقق المحلي بعد التعديل (نتائج صاحب المشروع):** `typecheck` ناجح، `npm test` 11/11، `verify:css` ناجح، `build` ناجح.
- **القبول:** أكّد صاحب المشروع موافقته على التعديلات بعد نجاح الفحوصات.

## 15. دمج v6 — 2026-11-15 (فرع `v6-testimonials`)

- **الملفات الجديدة (12):** `components/Testimonials.tsx`، `lib/spotlight-ui/{contract,desktop,mobile,index}.ts`، `tests/helpers/spotlight-harness.ts`، `tests/spotlight-{harness,desktop,mobile,mount,lifecycle}.test.ts`، `qa/v6-checklist.md`.
- **المعدّلة (2):** `app/[lang]/page.tsx` (استيراد المكوّن واستبدال قسم الآراء به؛ زر `ar` محفوظ) و`content/seed.json` (المفتاح `testimonials.dotLabel` فقط؛ اللهجة والدولار محفوظان). لم يُدمج `scripts/build_seed.py` (D8) ولا `MANIFEST.md`.
- **انحرافات مقصودة عن أصل v4** كما يسجّلها `MANIFEST.md` في الحزمة: إلغاء `requestAnimationFrame` المعلّق عند الإزالة النهائية فقط؛ قوائم اللمس الفارغة لا ترمي خطأً و`touchend` تستأنف التشغيل التلقائي دائماً؛ تُمسح مؤقّتات الاستئناف المعلّقة عند التفكيك؛ مستمع `resize` يُضاف ويُزال في `start()` و`stop()`؛ `mountSpotlight` تُرجع دالة إزالة (الأصل لم يكن فيه)؛ إصلاح في الـ harness (`touch` خطوة `x` اختيارية)؛ إضافة `cancelAnimationFrame` إلى `WinLike`. لم تُراجَع هذه الانحرافات سطراً بسطر في هذه الجلسة.
- **التحقق (نتائج أبلغ بها صاحب المشروع ملخصاً):** `typecheck` و`verify:css` و`build` ناجحة، و91 اختباراً ناجحاً. راجع الشكل بقائمة `qa/v6-checklist.md` ولم يطلب تغييرات.
- **لم يتحقق:** CI على الفرع (لا يعمل على الفروع إلا عبر Pull Request إلى `main`)، والدمج في `main`.
