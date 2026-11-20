# نشر الموقع: VPS + Cloudflare (خطوة بخطوة)

## الفكرة
- **VPS واحد** يشغّل البرنامجين: الموقع (Next.js على 3000) والسيرفر (على 8000)، ويتشاركان مجلد `data/`.
- **Cloudflare** يتولى الدومين وHTTPS والحماية، ويحمي صفحة `/admin` بدخول عبر البريد (Cloudflare Access). لا يستضيف Cloudflare Pages/Workers هذا المشروع لأن السيرفر يكتب ملفات على القرص.
- العناوين: `https://example.com` للموقع، و`https://api.example.com` للسيرفر.

## 1) تجهيز VPS (Ubuntu 24.04)
```bash
adduser deploy && usermod -aG sudo deploy      # ثم ادخل بحساب deploy
sudo apt update && sudo apt install -y git ufw
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt install -y nodejs
sudo ufw allow OpenSSH && sudo ufw enable       # لا تفتح 3000 ولا 8000
```

## 2) رفع المشروع
```bash
git clone <مستودعك> ~/site && cd ~/site
# انسخ ملفات الوسائط إلى public/assets/ (logo.svg, profile-photo.webp, hero-poster.jpg, hero-video.mp4, project-1..4.mp4)
npm ci
```

## 3) الإعدادات
`server/.env`:
```
ADMIN_TOKEN=<نص عشوائي طويل: openssl rand -hex 24>
HOST=127.0.0.1
PORT=8000
PUBLIC_URL=https://api.example.com
ALLOWED_ORIGINS=https://example.com
TRUST_PROXY=1
MAX_UPLOAD_MB=100
```
`.env.local` (يُقرأ وقت build):
```
NEXT_PUBLIC_API_BASE=https://api.example.com
NEXT_PUBLIC_ADMIN_API=https://api.example.com
NEXT_PUBLIC_MAX_UPLOAD_MB=100
```
ثم: `npm run build`

## 4) تشغيل دائم (systemd)
`/etc/systemd/system/site-api.service`:
```
[Unit]
Description=Portfolio API
After=network.target
[Service]
User=deploy
WorkingDirectory=/home/deploy/site
ExecStart=/usr/bin/node --env-file-if-exists=server/.env server/index.mjs
Restart=always
[Install]
WantedBy=multi-user.target
```
`/etc/systemd/system/site-web.service`: نفس الملف لكن `Description=Portfolio Web` و`ExecStart=/usr/bin/npm start` وأضف `Environment=PORT=3000`.
```bash
sudo systemctl daemon-reload && sudo systemctl enable --now site-api site-web
curl http://127.0.0.1:8000/health    # {"ok":true}
```

## 5) Cloudflare
1. أضف الدومين إلى Cloudflare وغيّر الـ nameservers عند المسجّل.
2. **Zero Trust ← Networks ← Tunnels ← Create tunnel** (cloudflared). ثبّته على الـ VPS بالأمر الذي يعطيك إياه، ثم أضف Public hostnames:
   - `example.com` ← `http://localhost:3000`
   - `api.example.com` ← `http://localhost:8000`
   (لا حاجة لفتح أي منفذ ولا لشهادة HTTPS؛ Cloudflare يتولاها.)
3. **حماية /admin:** Zero Trust ← Access ← Applications ← Add ← Self-hosted. الدومين `example.com` والمسار `admin`. السياسة: Allow ← Emails ← بريدك وبريد صاحب الموقع. يصل رمز دخول إلى البريد (بلا كلمة سر ثانية). هذا يغني عن بناء تسجيل دخول في الكود.
4. حدّ Cloudflare المجاني لحجم الطلب **100 ميغا**، وهو يكفي لفيديوهاتك (حتى 70). لا ترفع ملفاً أكبر.
5. SSL/TLS ← Overview ← Full (strict). فعّل Always Use HTTPS.

## 6) أول استخدام
افتح `https://example.com/admin`، أدخل بريدك ثم الرمز، ثم كلمة السر (ADMIN_TOKEN)، واضغط «تحقق».

## 7) نسخ احتياطي (مهم)
كل البيانات في `data/` (النصوص والرفع). أضف cron يومياً:
```bash
0 3 * * * tar czf /home/deploy/backup-$(date +\%F).tgz -C /home/deploy/site data && find /home/deploy -name 'backup-*.tgz' -mtime +14 -delete
```
وانسخ الملفات خارج الجهاز أيضاً (مثلاً إلى Cloudflare R2 أو جهازك).

## 8) التحديث لاحقاً
```bash
cd ~/site && git pull && npm ci && npm run build && sudo systemctl restart site-web site-api
```
