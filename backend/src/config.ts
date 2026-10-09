import "dotenv/config";

/** Runtime configuration, validated once at startup. Secrets only come from the environment. */
export interface Config {
  port: number;
  mongoUri: string;
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string;
  refreshTtl: string;
  corsOrigins: string[];
  authRateLimit: { windowMs: number; max: number } | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const need = (k: string): string => {
    const v = env[k];
    if (!v) throw new Error(`Missing required environment variable ${k}`);
    return v;
  };
  const accessSecret = need("JWT_ACCESS_SECRET");
  const refreshSecret = need("JWT_REFRESH_SECRET");
  if (accessSecret.length < 32 || refreshSecret.length < 32) {
    throw new Error("JWT secrets must be at least 32 characters");
  }
  return {
    port: Number(env.PORT ?? 4000),
    mongoUri: need("MONGODB_URI"),
    accessSecret,
    refreshSecret,
    accessTtl: "15m",
    refreshTtl: "30d",
    corsOrigins: (env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    authRateLimit: { windowMs: 15 * 60 * 1000, max: 20 },
  };
}
