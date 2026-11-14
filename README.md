# yousef-portfolio — Next.js v5 / v6a foundation

مشروع Portfolio باستخدام Next.js App Router وReact وTypeScript. يدعم المسارين `/ar` و`/en`، ويوجّه `/` إلى اللغة الافتراضية `ar`.

## المتطلبات
- Node.js 24
- npm

## التثبيت والتشغيل
```bash
npm ci
npm run dev
```

## الفحوصات
```bash
npm run typecheck
npm test
npm run verify:css
npm run build
```

يستخدم `package.json` إصدارات محددة ومتوافقة مع `package-lock.json`. استخدم `npm ci` لإعادة تثبيت الإصدارات المقفلة دون تغيير ملف القفل.

## الوسائط المحلية
ضع الوسائط داخل `public/assets/` بالأسماء التالية: `logo.svg`, `profile-photo.webp`, `hero-poster.jpg`, `hero-video.mp4`, `project-1.mp4`, `project-2.mp4`, `project-3.mp4`, `project-4.mp4`. راجع `public/assets/README.txt`.

مجلد الوسائط مستثنى من Git عمدًا؛ لذلك لن تُرفع هذه الملفات إلى GitHub. يجب الاحتفاظ بها محليًا لتشغيل الموقع ومراجعته بصريًا.

## البنية
- `app/`: App Router والصفحات والتوجيه من `/`.
- `components/`: مكونات الواجهة.
- `content/seed.json`: النصوص والوسائط والمجموعات.
- `lib/content/`: طبقة CRUD ومخزن المحتوى.
- `lib/spotlight.ts`: حسابات Spotlight المستقلة عن DOM.
- `tests/`: اختبارات البيانات وسلوك Spotlight.
- `.github/workflows/ci.yml`: فحوصات GitHub Actions.

## حالة التحقق
تم التحقق سابقًا محليًا من نجاح `npm run build` و`npm test` (11 اختبارًا) و`npm run verify:css`، كما نجح GitHub Actions بعد إصلاح التوجيه في commit `6593a24`. لا تُعد هذه العبارة بديلًا عن إعادة تشغيل الفحوصات بعد أي تعديل لاحق.
