import "dotenv/config";

/** Runtime configuration, validated once at startup. Secrets only come from the environment. */
export interface Config {
  port: number;
  mongoUri: string;
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string;
  refreshTtl: string;
  /** How long a just-rotated refresh token may be re-presented to re-deliver the same replacement (0 = off). */
  refreshReuseGraceMs: number;
  corsOrigins: string[];
  authRateLimit: { windowMs: number; max: number } | null;
  /** Per-user limit on the task API (null = off). */
  apiRateLimit: { windowMs: number; max: number } | null;
  /** Express "trust proxy": number of reverse-proxy hops in front of the app (0 = none). Needed for correct client IPs. */
  trustProxy: number;
  /** Reject plain-HTTP requests (via X-Forwarded-Proto) except health checks. Requires trustProxy >= 1. */
  requireHttps: boolean;
  logRequests: boolean;
  mongoServerSelectionTimeoutMs: number;
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
  if (accessSecret === refreshSecret) throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ");
  const trustProxy = Number(env.TRUST_PROXY ?? 0);
  const requireHttps = env.REQUIRE_HTTPS === "true";
  if (!Number.isInteger(trustProxy) || trustProxy < 0) throw new Error("TRUST_PROXY must be a non-negative integer");
  if (requireHttps && trustProxy < 1) throw new Error("REQUIRE_HTTPS=true needs TRUST_PROXY>=1 (the proxy reports the original protocol)");
  return {
    port: Number(env.PORT ?? 4000),
    mongoUri: need("MONGODB_URI"),
    accessSecret,
    refreshSecret,
    accessTtl: env.JWT_ACCESS_TTL ?? "15m",
    refreshTtl: "30d",
    refreshReuseGraceMs: Number(env.REFRESH_REUSE_GRACE_SECONDS ?? 30) * 1000,
    corsOrigins: (env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    authRateLimit: { windowMs: 15 * 60 * 1000, max: Number(env.AUTH_RATE_LIMIT_MAX ?? 20) },
    apiRateLimit: { windowMs: 60 * 1000, max: Number(env.API_RATE_LIMIT_MAX ?? 300) },
    trustProxy,
    requireHttps,
    logRequests: env.LOG_REQUESTS === "true",
    mongoServerSelectionTimeoutMs: Number(env.MONGO_SERVER_SELECTION_TIMEOUT_MS ?? 10000),
  };
}
