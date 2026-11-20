# server/ — API for the portfolio (M11)
Zero-dependency Node server (Node 24: `node:http`, `node:fs`, `node:crypto`). STATUS: UNVERIFIED on the owner's machine; sandbox tests only (`tests/server.test.ts`, 32 tests over real HTTP).

## What it does
| Route | Auth | Notes |
|---|---|---|
| `PUT /texts/{key}` | Bearer | body `{ar, en?}`; key like `hero.title` |
| `PUT /media/{id}` | Bearer | `{id,url,type,alt?}`; `javascript:`/`data:`/`//host`/`mailto:` refused |
| `POST /media/upload` | Bearer | multipart field `file`; jpg/png/webp/gif/mp4/webm; magic bytes checked; `MAX_UPLOAD_MB` (default 100); returns `{url}` |
| `PUT /collections/{name}/{id}` | Bearer | create or replace; per-collection schema, unknown fields refused; ids `[A-Za-z0-9_-]`, `order` reserved |
| `DELETE /collections/{name}/{id}` | Bearer | idempotent `{ok, deleted}` |
| `PUT /collections/{name}/order` | Bearer | `{ids}` must be exactly the current ids |
| `GET /inbox`, `GET /auth/check` | Bearer | inbox = submitted reviews and contact messages |
| `POST /reviews`, `POST /contact` | public | honeypot `website` → 422; 5 per hour per client (429 + `detail` + `Retry-After`) |
| `GET /uploads/{file}` | public | Range supported (video seeking), immutable cache |
| `GET /health` | public | `{ok:true}` |

Content is stored in `data/content.json` — **the same file the website reads** (`lib/content/index.ts`). First start copies `content/seed.json` there. Edits are atomic (temp file + rename, `.bak` of the previous version) and serialised. Reviews/messages go to `data/reviews.json` / `data/messages.json`; **nothing is published automatically**: read `GET /inbox`, then add a testimonial in `/admin`.

## Run (development, two terminals, repo root)
1. `copy server\.env.example server\.env` and set `ADMIN_TOKEN` (16+ random characters). Copy `.env.example` to `.env.local` (site).
2. Terminal 1: `npm run server`   → `API listening on http://127.0.0.1:8000`
3. Terminal 2: `npm run dev` (restart it after editing `.env.local`).
4. Open `http://localhost:3000/admin`, type the token in the token field, edit, Save. Reload `/ar`.
5. Smoke test: `$env:ADMIN_TOKEN="<token>"; npm run smoke`.

## Uploads (videos up to ~100 MB)
- `MAX_UPLOAD_MB` (default 100) must be >= your biggest video. 8 videos x 70 MB = ~560 MB of disk. Request timeout is 30 min (slow connections).
- Behind a reverse proxy raise its body limit: nginx `client_max_body_size 110m;`, Caddy needs no change. Cloudflare proxy (free) caps request bodies at 100 MB.
- Replaced uploads are NOT deleted (disk grows). The admin shows a progress bar and checks type and size before sending.

## Production notes (owner decisions needed)
- Site and server must share the same `data/` folder → one host. For two hosts you need a different storage layer (not built).
- Put both behind HTTPS (reverse proxy). Then set `TRUST_PROXY=1`, `HOST`, `PUBLIC_URL=https://api.example.com`, `ALLOWED_ORIGINS=https://example.com`, and `NEXT_PUBLIC_API_BASE` / `NEXT_PUBLIC_ADMIN_API` to the API URL before `next build`.
- `/admin` page itself has no login (it only shows public content); every write needs the token. Still protect `/admin` at the proxy if you can. Rotate the token by editing `server/.env` and restarting.
- Rate limits are in memory (reset on restart, one process). The token is sent in a header: use HTTPS or anyone on the network can read it.
- Not built: user accounts, password login, image resizing, virus scanning, backups beyond `content.json.bak`, deleting uploads, review moderation UI.
