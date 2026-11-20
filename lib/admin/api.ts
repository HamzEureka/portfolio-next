// STATUS: UNVERIFIED (Claude proposal). CLIENT side of the (not yet built) Python server contract: see docs/admin-api-contract.md.
// Owner decision 2026-11-16: every admin change is sent to the server. Nothing in this repo writes content files.
import type { LText, MediaSlot } from "../content/types";
import type { Item } from "./schema";

export interface AdminApi {
  putText(key: string, v: LText): Promise<void>;
  putMedia(slot: MediaSlot): Promise<void>;
  putItem(collection: string, item: Item): Promise<void>;
  deleteItem(collection: string, id: string): Promise<void>;
  setOrder(collection: string, ids: string[]): Promise<void>;
  uploadMedia(file: Blob, filename: string): Promise<{ url: string }>;
  /** Same as uploadMedia but reports 0..1 progress (XMLHttpRequest, browser only). Needed for 70 MB videos. */
  uploadWithProgress?(file: Blob, filename: string, onProgress: (fraction: number) => void): Promise<{ url: string }>;
  /** Resolves when the token is accepted by the server (GET /auth/check). */
  checkAuth?(): Promise<void>;
  /** Starts building + deploying the public site (POST /publish). */
  publish?(): Promise<void>;
  publishStatus?(): Promise<{ state: "idle" | "running" | "done" | "error"; message: string }>;
}
export class AdminApiError extends Error { constructor(public status: number, message: string) { super(message); } }

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string | FormData }) => Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<unknown> }>;
const enc = encodeURIComponent;

export class HttpAdminApi implements AdminApi {
  constructor(private base: string, private getToken: () => string | null, private f: FetchLike = (u, i) => fetch(u, i as RequestInit) as never) {}
  private async call(method: string, path: string, body?: unknown, form?: FormData) {
    const headers: Record<string, string> = {}; const t = this.getToken(); if (t) headers.Authorization = `Bearer ${t}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const r = await this.f(this.base.replace(/\/$/, "") + path, { method, headers, body: form ?? (body === undefined ? undefined : JSON.stringify(body)) });
    if (!r.ok) throw new AdminApiError(r.status, (await r.text().catch(() => "")).slice(0, 300) || `HTTP ${r.status}`);
    return r;
  }
  async putText(key: string, v: LText) { await this.call("PUT", `/texts/${enc(key)}`, v); }
  async putMedia(slot: MediaSlot) { await this.call("PUT", `/media/${enc(slot.id)}`, slot); }
  async putItem(c: string, item: Item) { await this.call("PUT", `/collections/${enc(c)}/${enc(item.id)}`, item); }
  async deleteItem(c: string, id: string) { await this.call("DELETE", `/collections/${enc(c)}/${enc(id)}`); }
  async setOrder(c: string, ids: string[]) { await this.call("PUT", `/collections/${enc(c)}/order`, { ids }); }
  async checkAuth() { await this.call("GET", "/auth/check"); }
  async publish() { await this.call("POST", "/publish"); }
  async publishStatus() { return (await this.call("GET", "/publish/status")) as unknown as { state: "idle" | "running" | "done" | "error"; message: string }; }
  /** Cloud storage when the server has it (browser uploads straight to Cloudinary with a server-signed ticket), else the server's own disk. */
  async uploadWithProgress(file: Blob, filename: string, onProgress: (fraction: number) => void): Promise<{ url: string }> {
    let ticket: { url: string; fields: Record<string, string | number> } | null = null;
    try { ticket = (await (await this.call("POST", "/media/sign")).json()) as typeof ticket; }
    catch (e) { if (!(e instanceof AdminApiError && e.status === 501)) throw e; }
    return ticket ? this.uploadToCloud(ticket, file, filename, onProgress) : this.uploadToServer(file, filename, onProgress);
  }
  private uploadToCloud(t: { url: string; fields: Record<string, string | number> }, file: Blob, filename: string, onProgress: (fraction: number) => void): Promise<{ url: string }> {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open("POST", t.url);
      x.timeout = 30 * 60 * 1000;
      x.upload.onprogress = (e) => { if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total); };
      x.onerror = x.ontimeout = () => reject(new AdminApiError(0, "network"));
      x.onload = () => {
        let j: { secure_url?: unknown; error?: { message?: string } } = {};
        try { j = JSON.parse(x.responseText); } catch { /* handled below */ }
        if (x.status < 200 || x.status >= 300 || typeof j.secure_url !== "string") return reject(new AdminApiError(x.status === 200 ? 502 : x.status, j.error?.message || `HTTP ${x.status}`));
        onProgress(1); resolve({ url: j.secure_url });
      };
      const fd = new FormData(); for (const [k, v] of Object.entries(t.fields)) fd.append(k, String(v)); fd.append("file", file, filename); x.send(fd);
    });
  }
  private uploadToServer(file: Blob, filename: string, onProgress: (fraction: number) => void): Promise<{ url: string }> {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open("POST", this.base.replace(/\/$/, "") + "/media/upload");
      const t = this.getToken(); if (t) x.setRequestHeader("Authorization", `Bearer ${t}`);
      x.timeout = 30 * 60 * 1000; // slow home connections: up to 30 minutes
      x.upload.onprogress = (e) => { if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total); };
      x.onerror = x.ontimeout = () => reject(new AdminApiError(0, "network"));
      x.onload = () => {
        if (x.status < 200 || x.status >= 300) return reject(new AdminApiError(x.status, (x.responseText || "").slice(0, 300) || `HTTP ${x.status}`));
        try { const j = JSON.parse(x.responseText) as { url?: unknown }; if (typeof j.url !== "string") throw 0; onProgress(1); resolve({ url: j.url }); }
        catch { reject(new AdminApiError(502, "upload response has no url")); }
      };
      const fd = new FormData(); fd.append("file", file, filename); x.send(fd);
    });
  }
  async uploadMedia(file: Blob, filename: string) {
    const fd = new FormData(); fd.append("file", file, filename);
    const r = await this.call("POST", "/media/upload", undefined, fd);
    const j = (await r.json()) as { url?: unknown };
    if (typeof j.url !== "string") throw new AdminApiError(502, "upload response has no url");
    return { url: j.url };
  }
}
