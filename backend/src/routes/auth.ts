import { Router } from "express";
import { createHash, randomUUID } from "node:crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { HttpError } from "../errors.js";
import { loginSchema, refreshSchema, registerSchema } from "../validation.js";
import type { Config } from "../config.js";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
// Hash of a throwaway password, verified when the email is unknown so response time doesn't reveal existence.
const DUMMY_HASH = await argon2.hash("dummy-password-1", { type: argon2.argon2id });

export function authRouter(cfg: Config): Router {
  const r = Router();

  async function issue(userId: string) {
    const jti = randomUUID();
    await User.updateOne({ _id: userId }, { refreshJti: sha(jti) });
    const accessToken = jwt.sign({ typ: "access" }, cfg.accessSecret, { subject: userId, expiresIn: cfg.accessTtl as never });
    const refreshToken = jwt.sign({ typ: "refresh", jti }, cfg.refreshSecret, { subject: userId, expiresIn: cfg.refreshTtl as never });
    return { accessToken, refreshToken };
  }

  r.post("/register", async (req, res) => {
    const { email, password } = registerSchema.parse(req.body);
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    try {
      const user = await User.create({ email, passwordHash });
      res.status(201).json({ user: { id: user.id, email: user.email }, ...(await issue(user.id)) });
    } catch (e) {
      // The unique index is the race-safe duplicate guard.
      if ((e as { code?: number }).code === 11000) throw new HttpError(409, "email_taken", "Email already registered");
      throw e;
    }
  });

  r.post("/login", async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ email });
    const ok = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, password);
    if (!user || !ok) throw new HttpError(401, "invalid_credentials", "Invalid email or password");
    res.json({ user: { id: user.id, email: user.email }, ...(await issue(user.id)) });
  });

  // Rotating refresh: a refresh token works once; reuse of an older one is rejected.
  r.post("/refresh", async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    let payload: jwt.JwtPayload;
    try {
      const p = jwt.verify(refreshToken, cfg.refreshSecret, { algorithms: ["HS256"] });
      if (typeof p === "string" || p["typ"] !== "refresh" || !p.sub || !p["jti"]) throw new Error("bad claims");
      payload = p;
    } catch {
      throw new HttpError(401, "invalid_refresh", "Invalid refresh token");
    }
    const user = await User.findById(payload.sub);
    if (!user || user.refreshJti !== sha(String(payload["jti"]))) throw new HttpError(401, "invalid_refresh", "Invalid refresh token");
    res.json(await issue(user.id));
  });

  return r;
}
