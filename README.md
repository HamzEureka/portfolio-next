# yousef-portfolio (Next.js) — v5

App Router + TypeScript. المسارات `/ar` و`/en`. المحتوى في `content/seed.json` (نصوص `{ar,en}`، وسائط `{id,url,type,alt}`، مجموعات).

## التشغيل
```
npm install
npm run dev          # أو: npm run build && npm start
npm test             # اختبارات طبقة البيانات (tsx)
npm run verify:css   # تأكد أن app/globals.css مطابق لـ CSS في v4
```
`package.json` يستعمل `latest`؛ بعد أول `npm install` يُثبّت `package-lock.json` الإصدارات. لم يُنفَّذ `npm install` ولا `next build` في بيئة الإنشاء (بلا شبكة).

## البنية
- `app/globals.css` = CSS الأصلي حرفياً (sha256 مُتحقَّق). `app/enhancements.css` و`app/skills.css` إضافات.
- `lib/content/` طبقة CRUD (`ContentStore`): نصوص، وسائط، مجموعات. التنفيذ الحالي: ملف JSON (`data/content.json` للتعديلات، والـ seed أصل). يُستبدل لاحقاً بعميل API للخادم دون تغيير المكوّنات.
- `scripts/build_seed.py` يعيد بناء الـ seed من مصدر v4.
