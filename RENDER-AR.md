# النشر على Render مع Cloudinary (موقع + لوحة تحكم + رفع، مجاناً)

خدمة واحدة على Render تشغّل الموقع والسيرفر معاً. الصور والفيديوهات تُرفع إلى Cloudinary، والنصوص والتعديلات تُنسخ إلى Cloudinary أيضاً،
فلا تضيع عند إعادة تشغيل Render (الذي يمسح قرصه).

## 1) خذ مفتاح Cloudinary
في [console.cloudinary.com](https://console.cloudinary.com): **Settings ← API Keys** (أو الصفحة الرئيسية «Dashboard»)، وانسخ **API environment variable**، شكله:
`cloudinary://123456789:AbCdEf...@your-cloud-name`
هذا سري: لا ترسله لأحد ولا تضعه في GitHub.

## 2) إعدادات خدمة Render (Settings ← Environment)
| الاسم | القيمة |
|---|---|
| `CLOUDINARY_URL` | القيمة المنسوخة أعلاه |
| `ADMIN_TOKEN` | كلمة سر لوحة التحكم، 16 حرفاً أو أكثر |
| `NEXT_PUBLIC_ADMIN_API` | `/api` |
| `NEXT_PUBLIC_API_BASE` | `/api` |
| `ALLOWED_ORIGINS` | رابط موقعك مثل `https://portfolio-next-0lf9.onrender.com` |
| `TRUST_PROXY` | `1` |
| `PUBLISH_CMD` | `off` |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` | `100` |

(المتغيرات التي تبدأ بـ `NEXT_PUBLIC_` تُقرأ وقت البناء، فبعد تغييرها اضغط **Manual Deploy ← Clear build cache & deploy**.)

وفي **Settings ← Build & Deploy**:
- Build Command: `npm install && npm run build`
- **Start Command: `npm run start:host`** (بدل `npm start`)

## 3) جرّب
افتح `https://<موقعك>.onrender.com/admin`، اكتب `ADMIN_TOKEN` ثم «تحقق». ارفع صورة/فيديو في «الأعمال والمحتوى»، احفظ، وتأكد أنه يظهر في الموقع،
ثم اضغط **Manual Deploy** (إعادة تشغيل) وتأكد أن التعديل ما زال موجوداً.

## حدود يجب معرفتها
- **Cloudinary المجاني:** الفيديو حتى 100 ميغا، **والصورة حتى 10 ميغا**. الرصيد 25 شهرياً يُستهلك بالتخزين والبث، فاضغط الفيديوهات قبل الرفع (15–25 ميغا تكفي للويب).
- **الموقع ينام** بعد 15 دقيقة بلا زيارات وأول زيارة تتأخر نحو دقيقة.
- أي رفع/تعديل لا يظهر مباشرة إلا لأن الموقع يقرأ المحتوى كل مرة؛ فلا حاجة لزر «انشر» هنا (لهذا `PUBLISH_CMD=off`).
- لم يُجرَّب الربط مع Cloudinary الحقيقي من بيئتي (لا إنترنت لها)، فأول رفع عندك هو الاختبار الفعلي.
