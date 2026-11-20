export interface CloudinaryConfig { apiKey: string; apiSecret: string; cloudName: string }
export function parseCloudinaryUrl(u: unknown): CloudinaryConfig | null;
export function signParams(params: Record<string, string | number>, apiSecret: string): string;
export const ALLOWED_FORMATS: string;
export function signBrowserUpload(cfg: CloudinaryConfig, now?: number): { url: string; fields: Record<string, string | number> };
export function createRemoteStore(cfg: CloudinaryConfig, fetchImpl?: typeof fetch): {
  push(name: string, buf: Buffer | Uint8Array): Promise<void>;
  pull(name: string): Promise<Buffer | null>;
};
export function seal(buf: Buffer | Uint8Array, secret: string): Buffer;
export function unseal(buf: Buffer | Uint8Array, secret: string): Buffer;
export function privateName(name: string, secret: string): string;
