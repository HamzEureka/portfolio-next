// STATUS: UNVERIFIED (Claude, M11). Start: `npm run server` (reads server/.env if present; see server/.env.example and server/README.md).
import http from "node:http";
import path from "node:path";
import { createApp } from "./app.mjs";
import { parseCloudinaryUrl, createRemoteStore } from "./cloudinary.mjs";

const root = path.resolve(import.meta.dirname, "..");
const env = process.env;
const list = (s) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);

const cld = parseCloudinaryUrl(env.CLOUDINARY_URL);
if (env.CLOUDINARY_URL && !cld) { console.error("CLOUDINARY_URL is malformed. Expected cloudinary://API_KEY:API_SECRET@CLOUD_NAME"); process.exit(1); }
let app;
try {
  app = createApp({
    token: env.ADMIN_TOKEN || "",
    dataDir: path.resolve(env.DATA_DIR || path.join(root, "data")),
    seedFile: path.join(root, "content", "seed.json"),
    allowedOrigins: list(env.ALLOWED_ORIGINS || "http://localhost:3000"),
    publicUrl: env.PUBLIC_URL || null,
    maxUploadBytes: (Number(env.MAX_UPLOAD_MB) || 100) * 1024 * 1024,
    publish: env.PUBLISH_CMD === "off" ? null : { cmd: (env.PUBLISH_CMD || "node scripts/publish.mjs").split(/\s+/), cwd: root, statusFile: path.join(root, ".publish", "status.json") },
    cloudinary: cld, remote: cld ? createRemoteStore(cld) : null,
    trustProxy: env.TRUST_PROXY === "1",
    log: (kind, ...a) => (kind === "error" ? console.error(new Date().toISOString(), ...a) : console.log(new Date().toISOString(), ...a)),
  });
} catch (e) {
  console.error("Cannot start:", e.message);
  console.error("Set ADMIN_TOKEN (16+ characters) in server/.env or the environment.");
  process.exit(1);
}
await app.ready;
const port = Number(env.PORT) || 8000, host = env.HOST || "127.0.0.1";
const server = http.createServer(app.handler);
server.requestTimeout = 30 * 60_000; // big video uploads on slow connections (70 MB x 8 videos)
server.headersTimeout = 20_000;
server.listen(port, host, () => console.log(`API listening on http://${host}:${port}  (data: ${env.DATA_DIR || path.join(root, "data")})`));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.close(() => process.exit(0)));
