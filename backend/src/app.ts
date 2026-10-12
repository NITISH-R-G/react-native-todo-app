import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { ZodError } from "zod";
import type { Config } from "./config.js";
import { HttpError } from "./errors.js";
import { requireAuth } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { tasksRouter } from "./routes/tasks.js";

export interface AppDeps {
  /** Resolves true when dependencies (MongoDB) can serve traffic; backs GET /ready. */
  isReady?: () => Promise<boolean>;
}

/** Builds the Express app from explicit config so tests can run it without environment variables. */
export function createApp(cfg: Config, deps: AppDeps = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", cfg.trustProxy);
  if (cfg.logRequests) {
    // One JSON line per request: method, path WITHOUT query string, status, duration. Never bodies or headers.
    app.use((req, res, next) => {
      const t0 = Date.now();
      res.on("finish", () => console.log(JSON.stringify({ t: new Date().toISOString(), m: req.method, p: req.originalUrl.split("?")[0], s: res.statusCode, ms: Date.now() - t0 })));
      next();
    });
  }
  if (cfg.requireHttps) {
    app.use((req, res, next) => {
      if (req.secure || req.path === "/health" || req.path === "/ready") return next();
      res.status(426).json({ error: { code: "https_required", message: "HTTPS is required" } });
    });
  }
  app.use(helmet());
  // Native mobile clients send no Origin; browsers are only allowed from the configured allowlist.
  app.use(cors({ origin: cfg.corsOrigins.length ? cfg.corsOrigins : false }));
  app.use(express.json({ limit: "32kb" }));

  // Liveness (process is up) vs readiness (can reach MongoDB). Platforms should restart on /health, route on /ready.
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/ready", async (_req, res) => {
    let ready = false;
    try {
      ready = deps.isReady ? await deps.isReady() : true;
    } catch {
      ready = false;
    }
    res.status(ready ? 200 : 503).json({ ready });
  });
  if (cfg.authRateLimit) {
    app.use(
      "/auth",
      rateLimit({
        ...cfg.authRateLimit,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: { code: "rate_limited", message: "Too many attempts, try later" } },
      }),
    );
  }
  app.use("/auth", authRouter(cfg));
  app.use("/tasks", requireAuth(cfg.accessSecret), apiLimiter(cfg), tasksRouter());

  app.use((_req, _res, next) => next(new HttpError(404, "not_found", "Route not found")));
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    const type = (err as { type?: string }).type;
    if (err instanceof ZodError) {
      res.status(400).json({
        error: { code: "validation_error", message: "Validation failed", details: err.issues.map((i) => ({ path: i.path, message: i.message })) },
      });
    } else if (err instanceof HttpError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    } else if (type === "entity.parse.failed") {
      res.status(400).json({ error: { code: "bad_json", message: "Malformed JSON body" } });
    } else if (type === "entity.too.large") {
      res.status(413).json({ error: { code: "too_large", message: "Body too large" } });
    } else {
      console.error("unhandled", err instanceof Error ? err.message : "unknown"); // never log bodies or tokens
      res.status(500).json({ error: { code: "internal", message: "Internal server error" } });
    }
  };
  app.use(onError);
  return app;
}

/** Per-user limiter for the task API; runs after authentication so the key is the verified user id, not an IP. */
function apiLimiter(cfg: Config): RequestHandler {
  if (!cfg.apiRateLimit) return (_req, _res, next) => next();
  return rateLimit({
    ...cfg.apiRateLimit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.userId ?? "anonymous",
    validate: { keyGeneratorIpFallback: false },
    message: { error: { code: "rate_limited", message: "Too many requests, slow down" } },
  });
}
