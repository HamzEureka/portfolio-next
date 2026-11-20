// Production start for a single host (Render): the API on 127.0.0.1:8000 and the site on $PORT. If one exits, both stop and the host restarts them.
import { spawn } from "node:child_process";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const env = { ...process.env, PROXY_API: "1" };
const api = spawn(process.execPath, ["server/index.mjs"], { cwd: root, stdio: "inherit", env: { ...env, PORT: "8000", HOST: "127.0.0.1" } });
const site = spawn(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-H", "0.0.0.0", "-p", env.PORT || "3000"], { cwd: root, stdio: "inherit", env });
const stop = (code) => { api.kill(); site.kill(); process.exit(code ?? 1); };
api.on("exit", (c) => { console.error("API exited", c); stop(c); });
site.on("exit", (c) => { console.error("site exited", c); stop(c); });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => stop(0));
