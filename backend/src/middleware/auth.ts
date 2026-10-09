import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { HttpError } from "../errors.js";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}

/** Verifies the Bearer access token. userId is only ever derived from the verified token. */
export function requireAuth(accessSecret: string): RequestHandler {
  return (req, _res, next) => {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) return next(new HttpError(401, "unauthorized", "Missing bearer token"));
    try {
      const p = jwt.verify(h.slice(7), accessSecret, { algorithms: ["HS256"] });
      if (typeof p === "string" || p["typ"] !== "access" || typeof p.sub !== "string") throw new Error("bad claims");
      req.userId = p.sub;
      next();
    } catch (e) {
      const expired = e instanceof jwt.TokenExpiredError;
      next(new HttpError(401, expired ? "token_expired" : "unauthorized", expired ? "Access token expired" : "Invalid token"));
    }
  };
}
