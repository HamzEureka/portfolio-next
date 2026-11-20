export interface AppConfig {
  token: string; dataDir: string; seedFile: string; allowedOrigins?: string[]; publicUrl?: string | null; maxUploadBytes?: number;
  trustProxy?: boolean; now?: () => number; log?: (kind: string, ...a: unknown[]) => void;
  limits?: Partial<Record<"form" | "formGlobal" | "authFail" | "admin", { windowMs: number; max: number }>>;
}
export function createApp(cfg: AppConfig): { handler: (req: never, res: never) => Promise<void>; ready: Promise<void> };
