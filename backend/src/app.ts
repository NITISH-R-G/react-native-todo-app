import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { ZodError } from "zod";
import type { Config } from "./config.js";
import { HttpError } from "./errors.js";
import { requireAuth } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { tasksRouter } from "./routes/tasks.js";

/** Builds the Express app from explicit config so tests can run it without environment variables. */
export function createApp(cfg: Config) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  // Native mobile clients send no Origin; browsers are only allowed from the configured allowlist.
  app.use(cors({ origin: cfg.corsOrigins.length ? cfg.corsOrigins : false }));
  app.use(express.json({ limit: "32kb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));
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
  app.use("/tasks", requireAuth(cfg.accessSecret), tasksRouter());

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
