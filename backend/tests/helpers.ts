import type { Config } from "../src/config.js";

/** Config for tests: explicit values, no environment variables, rate limits off unless a test turns them on. */
export const testConfig = (overrides: Partial<Config> = {}): Config => ({
  port: 0,
  mongoUri: "",
  accessSecret: "a".repeat(40),
  refreshSecret: "b".repeat(40),
  accessTtl: "15m",
  refreshTtl: "30d",
  refreshReuseGraceMs: 1500, // short so expiry can be tested with a real clock
  corsOrigins: [],
  authRateLimit: null,
  apiRateLimit: null,
  trustProxy: 0,
  requireHttps: false,
  logRequests: false,
  mongoServerSelectionTimeoutMs: 1000,
  ...overrides,
});
