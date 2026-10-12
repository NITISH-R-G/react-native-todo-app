import { Router } from "express";
import { createHash, randomUUID } from "node:crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { MAX_SESSIONS, User } from "../models/User.js";
import { HttpError } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import { Task } from "../models/Task.js";
import { deleteAccountSchema, loginSchema, refreshSchema, registerSchema } from "../validation.js";
import type { Config } from "../config.js";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
// Hash of a throwaway password, verified when the email is unknown so response time doesn't reveal existence.
const DUMMY_HASH = await argon2.hash("dummy-password-1", { type: argon2.argon2id });

export function authRouter(cfg: Config): Router {
  const r = Router();

  /** Deterministic for a given (user, jti, issuedAt): signing the same inputs yields the same token string. */
  function sign(userId: string, jti: string, issuedAt = new Date()) {
    const iat = Math.floor(issuedAt.getTime() / 1000);
    const accessToken = jwt.sign({ typ: "access" }, cfg.accessSecret, { subject: userId, expiresIn: cfg.accessTtl as never });
    const refreshToken = jwt.sign({ typ: "refresh", jti, iat }, cfg.refreshSecret, { subject: userId, expiresIn: cfg.refreshTtl as never });
    return { accessToken, refreshToken };
  }

  /** New session (register / login): adds an entry, keeping the newest MAX_SESSIONS. Other devices stay signed in. */
  async function startSession(userId: string) {
    const jti = randomUUID();
    const now = new Date();
    await User.updateOne(
      { _id: userId },
      { $push: { refreshTokens: { $each: [{ hash: sha(jti), jti, rotatedAt: now, prevHash: null, createdAt: now }], $slice: -MAX_SESSIONS } } },
    );
    return sign(userId, jti, now);
  }

  /**
   * Rotates one session's refresh token with a single atomic match-and-replace, so a token is redeemed
   * (rotated) at most once even under concurrency.
   *
   * Durability window: if the response is lost (app killed, storage write failed) the client still holds the
   * old token. Within refreshReuseGraceMs of the rotation, presenting that old token again is answered with the
   * SAME replacement token (idempotent re-delivery; nothing is rotated or created). The old token is dead as
   * soon as the replacement is redeemed (it is then two generations old), when the grace expires, or when the
   * session is logged out or evicted. Reuse outside those bounds is rejected.
   */
  async function rotateSession(userId: string, oldJti: string) {
    const oldHash = sha(oldJti);
    const jti = randomUUID();
    const now = new Date();
    const rotated = await User.findOneAndUpdate(
      { _id: userId, "refreshTokens.hash": oldHash },
      { $set: { "refreshTokens.$.hash": sha(jti), "refreshTokens.$.jti": jti, "refreshTokens.$.rotatedAt": now, "refreshTokens.$.prevHash": oldHash } },
    );
    if (rotated) return sign(userId, jti, now);
    if (cfg.refreshReuseGraceMs <= 0) return null;
    const user = await User.findOne({ _id: userId, refreshTokens: { $elemMatch: { prevHash: oldHash, rotatedAt: { $gte: new Date(Date.now() - cfg.refreshReuseGraceMs) } } } });
    const entry = user?.refreshTokens.find((t) => t.prevHash === oldHash);
    if (!entry?.jti || !entry.rotatedAt) return null; // sessions created before this field existed cannot be re-delivered
    return sign(userId, entry.jti, entry.rotatedAt);
  }

  r.post("/register", async (req, res) => {
    const { email, password } = registerSchema.parse(req.body);
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    try {
      const user = await User.create({ email, passwordHash });
      res.status(201).json({ user: { id: user.id, email: user.email }, ...(await startSession(user.id)) });
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
    res.json({ user: { id: user.id, email: user.email }, ...(await startSession(user.id)) });
  });

  // Rotating refresh: each refresh token works once; reuse (or a lost race) is rejected.
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
    const tokens = await rotateSession(String(payload.sub), String(payload["jti"]));
    if (!tokens) throw new HttpError(401, "invalid_refresh", "Invalid refresh token");
    res.json(tokens);
  });

  // Server-side sign-out of this session only. Idempotent: an unknown/used token still returns 204.
  r.post("/logout", async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    try {
      const p = jwt.verify(refreshToken, cfg.refreshSecret, { algorithms: ["HS256"] });
      if (typeof p !== "string" && p["typ"] === "refresh" && p.sub && p["jti"]) {
        await User.updateOne({ _id: p.sub }, { $pull: { refreshTokens: { hash: sha(String(p["jti"])) } } });
      }
    } catch {
      // Expired/forged token: nothing to revoke.
    }
    res.status(204).end();
  });

  /**
   * Account deletion (required by Google Play for apps with account creation). Needs a valid access token AND the
   * password (a stolen access token alone cannot erase an account). Deletes the user's tasks first, then the user
   * (which also removes every session); if interrupted in between it is safe to retry.
   */
  r.delete("/account", requireAuth(cfg.accessSecret), async (req, res) => {
    const { password } = deleteAccountSchema.parse(req.body);
    const user = await User.findById(req.userId);
    const ok = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, password);
    // 401 means "your token is not valid" (clients react by refreshing); a wrong confirmation password is 403.
    if (!user) throw new HttpError(401, "unauthorized", "Account no longer exists");
    if (!ok) throw new HttpError(403, "invalid_credentials", "Invalid password");
    await Task.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });
    res.status(204).end();
  });

  return r;
}
