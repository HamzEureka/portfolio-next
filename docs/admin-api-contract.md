# Admin API contract (client AND server built; see server/README.md)
STATUS: UNVERIFIED (server added in M11, tests/server.test.ts). Owner decision 2026-11-16: every admin change goes to the server over HTTP. Base URL: `NEXT_PUBLIC_ADMIN_API`. Auth: `Authorization: Bearer <token>`.

| Call | Request | Success |
|---|---|---|
| PUT /texts/{key} | body `{ar, en?}` | 2xx |
| PUT /media/{id} | body `{id,url,type,alt?}` | 2xx |
| PUT /collections/{name}/{id} | body item (has `id`) | 2xx (create or replace) |
| DELETE /collections/{name}/{id} | none | 2xx |
| PUT /collections/{name}/order | `{ids:[...]}` | 2xx |
| POST /media/upload | multipart field `file` | 2xx `{url}` |

Public forms (extras): `POST {NEXT_PUBLIC_API_BASE}/reviews` `{name,role,text,website}` and `POST .../contact` `{name,email,msg,website}`: 2xx ok, 422 invalid, 429 rate limited (`detail` string). `website` is a honeypot: reject non-empty.

Server MUST: authenticate every admin write (the /admin page has no auth of its own), re-validate (the browser validators are convenience only), refuse `javascript:`/`data:` URLs, size-limit uploads, rate-limit public forms, allow CORS for the site origin. Order of calls from the UI per collection: deletes, puts, then order.
Server: `server/` (M11), zero dependencies; extra routes beyond this contract: `GET /inbox`, `GET /auth/check`, `GET /uploads/{file}`, `GET /health`. Responses to errors are `{detail: string}`.
