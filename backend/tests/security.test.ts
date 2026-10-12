import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { User } from "../src/models/User.js";
import { Task } from "../src/models/Task.js";
import { testConfig } from "./helpers.js";

// Security audit checks against the real app and a real mongod. Each test targets a distinct risk.
let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("sec_test"));
  await Promise.all([User.init(), Task.init()]);
}, 300_000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const creds = (email: string) => ({ email, password: "Passw0rdOK" });
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
let seq = 0;
async function signup(api: ReturnType<typeof request>) {
  const res = await api.post("/auth/register").send(creds(`sec${++seq}-${Date.now()}@example.com`));
  expect(res.status).toBe(201);
  return res.body as { accessToken: string; refreshToken: string; user: { id: string } };
}

describe("authentication boundary", () => {
  const api = request(createApp(testConfig()));
  const oid = "507f1f77bcf86cd799439011";

  it.each([
    ["GET", "/tasks"],
    ["POST", "/tasks"],
    ["GET", `/tasks/${oid}`],
    ["PATCH", `/tasks/${oid}`],
    ["DELETE", `/tasks/${oid}`],
  ])("%s %s requires a valid access token", async (method, path) => {
    const none = await (api as never as Record<string, (p: string) => request.Test>)[method.toLowerCase()]!(path);
    expect(none.status).toBe(401);
    expect(none.body.error.code).toBe("unauthorized");
    const bad = await (api as never as Record<string, (p: string) => request.Test>)[method.toLowerCase()]!(path).set(bearer("not.a.jwt"));
    expect(bad.status).toBe(401);
  });

  it("rejects an unsigned (alg=none) token and a token signed with the refresh secret", async () => {
    const { user } = await signup(api);
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: user.id, typ: "access" })}.`;
    expect((await api.get("/tasks").set(bearer(none))).status).toBe(401);
    const wrongKey = jwt.sign({ typ: "access" }, "b".repeat(40), { subject: user.id });
    expect((await api.get("/tasks").set(bearer(wrongKey))).status).toBe(401);
  });

  it("the public surface is exactly health, ready, register, login, refresh, logout", async () => {
    expect((await api.get("/health")).status).toBe(200);
    expect((await api.get("/ready")).status).toBe(200);
    for (const path of ["/auth/me", "/users", "/admin", "/tasks/../auth", "/.env", "/debug"]) {
      const r = await api.get(path);
      expect([401, 404]).toContain(r.status);
      expect(r.body.error).toBeTruthy(); // JSON error envelope, never an HTML stack page
    }
  });
});

describe("injection and malformed input", () => {
  const api = request(createApp(testConfig()));

  it("operator objects in credentials are rejected as validation errors, not interpreted by MongoDB", async () => {
    await signup(api);
    const r1 = await api.post("/auth/login").send({ email: { $gt: "" }, password: { $ne: "x" } });
    expect(r1.status).toBe(400);
    const r2 = await api.post("/auth/register").send({ email: { $ne: null }, password: "Passw0rdOK" });
    expect(r2.status).toBe(400);
  });

  it("operator syntax in query strings and ids cannot widen a query beyond the caller's own tasks", async () => {
    const a = await signup(api);
    const b = await signup(api);
    await api.post("/tasks").set(bearer(a.accessToken)).send({ title: "a-secret", tags: ["x"] });
    await api.post("/tasks").set(bearer(b.accessToken)).send({ title: "b-own", tags: ["x"] });
    for (const qs of ["?tag[$ne]=zzz", "?status[$ne]=active", "?tag=%7B%22$ne%22:%22x%22%7D", "?sort[$gt]=1"]) {
      const res = await api.get(`/tasks${qs}`).set(bearer(b.accessToken));
      expect([200, 400]).toContain(res.status);
      if (res.status === 200) expect(res.body.tasks.map((t: { title: string }) => t.title)).not.toContain("a-secret");
    }
    expect((await api.get("/tasks/%7B%22$ne%22:1%7D").set(bearer(b.accessToken))).status).toBe(404);
  });

  it("oversized bodies, long fields and prototype-pollution keys are refused", async () => {
    const a = await signup(api);
    const big = await api.post("/tasks").set(bearer(a.accessToken)).send({ title: "x".repeat(40_000) });
    expect(big.status).toBe(413);
    expect(big.body.error.code).toBe("too_large");
    expect((await api.post("/tasks").set(bearer(a.accessToken)).send({ title: "x".repeat(201) })).status).toBe(400);
    expect((await api.post("/auth/register").send({ email: "p@example.com", password: "A1" + "x".repeat(200) })).status).toBe(400);
    const polluted = await api.post("/tasks").set(bearer(a.accessToken)).send(JSON.parse('{"title":"t","__proto__":{"isAdmin":true},"constructor":{"x":1}}'));
    expect(polluted.status).toBe(400); // strict schema: unknown keys are errors
    expect(({} as Record<string, unknown>)["isAdmin"]).toBeUndefined();
  });

  it("every error uses the same envelope and none leaks internals", async () => {
    const a = await signup(api);
    const cases = [
      await api.get("/nope"),
      await api.get("/tasks"),
      await api.post("/tasks").set(bearer(a.accessToken)).send({}),
      await api.post("/auth/login").send({ email: "x@example.com", password: "wrong" }),
      await api.post("/tasks").set(bearer(a.accessToken)).set("Content-Type", "application/json").send("{bad"),
    ];
    for (const r of cases) {
      expect(typeof r.body.error.code).toBe("string");
      expect(typeof r.body.error.message).toBe("string");
      expect(JSON.stringify(r.body)).not.toMatch(/stack|node_modules|mongoose|MongoServerError|at \S+ \(/i);
    }
  });
});

describe("sensitive data exposure", () => {
  const api = request(createApp(testConfig()));
  const SECRET_PATTERN = /passwordHash|\$argon2|refreshTokens|prevHash|"jti"|accessSecret|refreshSecret|JWT_/i;

  it("no response body contains hashes, session records, or secrets", async () => {
    const reg = await api.post("/auth/register").send(creds(`leak${Date.now()}@example.com`));
    const login = await api.post("/auth/login").send(creds(reg.body.user.email));
    const refreshed = await api.post("/auth/refresh").send({ refreshToken: login.body.refreshToken });
    const t = await api.post("/tasks").set(bearer(login.body.accessToken)).send({ title: "x" });
    const list = await api.get("/tasks").set(bearer(login.body.accessToken));
    for (const r of [reg, login, refreshed, t, list]) expect(JSON.stringify(r.body)).not.toMatch(SECRET_PATTERN);
    expect(Object.keys(reg.body.user).sort()).toEqual(["email", "id"]);
  });

  it("stored credentials: argon2id hash, no plaintext password, refresh tokens only as SHA-256 hashes", async () => {
    const email = `store${Date.now()}@example.com`;
    const reg = await api.post("/auth/register").send(creds(email));
    const raw = await User.findOne({ email }).lean();
    expect(raw?.passwordHash).toMatch(/^\$argon2id\$/);
    const dump = JSON.stringify(raw);
    expect(dump).not.toContain("Passw0rdOK");
    expect(dump).not.toContain(reg.body.refreshToken);
    expect(raw?.refreshTokens?.[0]?.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("transport and browser protections", () => {
  it("sends security headers and hides the framework", async () => {
    const res = await request(createApp(testConfig())).get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toMatch(/max-age=/);
    expect(res.headers["x-frame-options"]).toBeTruthy();
  });

  it("CORS: no origin is trusted by default; only the configured allowlist is", async () => {
    const closed = await request(createApp(testConfig())).get("/health").set("Origin", "https://evil.example");
    expect(closed.headers["access-control-allow-origin"]).toBeUndefined();
    const app = request(createApp(testConfig({ corsOrigins: ["https://app.example.com"] })));
    const ok = await app.get("/health").set("Origin", "https://app.example.com");
    expect(ok.headers["access-control-allow-origin"]).toBe("https://app.example.com");
    const evil = await app.get("/health").set("Origin", "https://evil.example");
    expect(evil.headers["access-control-allow-origin"]).toBeUndefined();
    const pre = await app.options("/tasks").set("Origin", "https://evil.example").set("Access-Control-Request-Method", "GET");
    expect(pre.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("REQUIRE_HTTPS: plain HTTP is refused except health checks; the proxy's forwarded proto is honoured", async () => {
    const app = request(createApp(testConfig({ requireHttps: true, trustProxy: 1 })));
    const plain = await app.post("/auth/login").send(creds("x@example.com"));
    expect(plain.status).toBe(426);
    expect(plain.body.error.code).toBe("https_required");
    expect((await app.get("/health")).status).toBe(200);
    const tls = await app.post("/auth/login").set("X-Forwarded-Proto", "https").send(creds("x@example.com"));
    expect(tls.status).toBe(401); // reached the handler (unknown user), not blocked
  });

  it("config refuses unsafe combinations", () => {
    const base = { JWT_ACCESS_SECRET: "a".repeat(32), JWT_REFRESH_SECRET: "b".repeat(32), MONGODB_URI: "mongodb://x/y" };
    expect(() => loadConfig({ ...base, JWT_REFRESH_SECRET: base.JWT_ACCESS_SECRET })).toThrow(/must differ/);
    expect(() => loadConfig({ ...base, JWT_ACCESS_SECRET: "short" })).toThrow(/32 characters/);
    expect(() => loadConfig({ ...base, REQUIRE_HTTPS: "true" })).toThrow(/TRUST_PROXY/);
    expect(() => loadConfig({ ...base, TRUST_PROXY: "-1" })).toThrow(/non-negative/);
    expect(() => loadConfig({ ...base, JWT_ACCESS_SECRET: undefined })).toThrow(/JWT_ACCESS_SECRET/);
    const ok = loadConfig({ ...base, REQUIRE_HTTPS: "true", TRUST_PROXY: "1" });
    expect(ok.requireHttps && ok.trustProxy === 1).toBe(true);
  });
});

describe("rate limiting", () => {
  it("auth endpoints answer 429 with the standard envelope once the budget is spent", async () => {
    const api = request(createApp(testConfig({ authRateLimit: { windowMs: 60_000, max: 3 } })));
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await api.post("/auth/login").send({ email: "nobody@example.com", password: "Wrong1234" })).status);
    expect(codes).toEqual([401, 401, 401, 429, 429]);
    const blocked = await api.post("/auth/login").send({ email: "nobody@example.com", password: "Wrong1234" });
    expect(blocked.body.error.code).toBe("rate_limited");
    expect(blocked.headers["ratelimit-limit"] ?? blocked.headers["ratelimit"]).toBeTruthy();
    expect((await api.get("/health")).status).toBe(200); // other routes unaffected
  });

  it("without TRUST_PROXY, a spoofed X-Forwarded-For cannot dodge the limit", async () => {
    const api = request(createApp(testConfig({ authRateLimit: { windowMs: 60_000, max: 2 }, trustProxy: 0 })));
    const send = (ip: string) => api.post("/auth/login").set("X-Forwarded-For", ip).send({ email: "a@example.com", password: "Wrong1234" });
    expect([(await send("1.1.1.1")).status, (await send("2.2.2.2")).status, (await send("3.3.3.3")).status]).toEqual([401, 401, 429]);
  });

  it("behind one proxy hop, clients are limited individually (not all lumped under the proxy address)", async () => {
    const api = request(createApp(testConfig({ authRateLimit: { windowMs: 60_000, max: 2 }, trustProxy: 1 })));
    const send = (ip: string) => api.post("/auth/login").set("X-Forwarded-For", ip).send({ email: "a@example.com", password: "Wrong1234" });
    await send("10.0.0.1");
    await send("10.0.0.1");
    expect((await send("10.0.0.1")).status).toBe(429); // client A is out of budget
    expect((await send("10.0.0.2")).status).toBe(401); // client B is unaffected
  });

  it("the task API is limited per authenticated user, not per IP", async () => {
    const api = request(createApp(testConfig({ apiRateLimit: { windowMs: 60_000, max: 3 } })));
    const a = await signup(api);
    const b = await signup(api);
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await api.get("/tasks").set(bearer(a.accessToken))).status);
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
    expect((await api.get("/tasks").set(bearer(b.accessToken))).status).toBe(200); // same IP, other user
  });
});

describe("request logging", () => {
  it("logs method, full path and status only: no query string, body, or credentials", async () => {
    const lines: string[] = [];
    const orig = console.log;
    console.log = (...a: unknown[]) => { lines.push(a.map(String).join(" ")); };
    try {
      const api = request(createApp(testConfig({ logRequests: true })));
      await api.post("/auth/login?token=SECRETQUERY").set("Authorization", "Bearer SECRETBEARER").send({ email: "x@example.com", password: "SecretPw123" });
    } finally {
      console.log = orig;
    }
    const entry = JSON.parse(lines.find((l) => l.includes('"/auth/login"'))!);
    expect(entry).toMatchObject({ m: "POST", p: "/auth/login", s: 401 });
    expect(lines.join("\n")).not.toMatch(/SECRETQUERY|SECRETBEARER|SecretPw123|x@example.com/);
  });
});

describe("account deletion", () => {
  const api = request(createApp(testConfig()));

  it("requires auth AND the correct password; wrong password deletes nothing", async () => {
    const a = await signup(api);
    await api.post("/tasks").set(bearer(a.accessToken)).send({ title: "keep me" });
    expect((await api.delete("/auth/account").send({ password: "Passw0rdOK" })).status).toBe(401); // no token
    const wrong = await api.delete("/auth/account").set(bearer(a.accessToken)).send({ password: "WrongPass1" });
    expect(wrong.status).toBe(403); // not 401: the token is fine, the confirmation is wrong
    expect(wrong.body.error.code).toBe("invalid_credentials");
    expect((await api.delete("/auth/account").set(bearer(a.accessToken)).send({})).status).toBe(400);
    expect(await User.countDocuments({ _id: a.user.id })).toBe(1);
    expect(await Task.countDocuments({ userId: a.user.id })).toBe(1);
  });

  it("deletes the user, every task and every session, without touching other users", async () => {
    const a = await signup(api);
    const b = await signup(api);
    await api.post("/tasks").set(bearer(a.accessToken)).send({ title: "a1" });
    await api.post("/tasks").set(bearer(a.accessToken)).send({ title: "a2" });
    await api.post("/tasks").set(bearer(b.accessToken)).send({ title: "b1" });
    const email = (await User.findById(a.user.id).lean())!.email;
    const second = (await api.post("/auth/login").send(creds(email))).body; // a second session for A
    const del = await api.delete("/auth/account").set(bearer(a.accessToken)).send({ password: "Passw0rdOK" });
    expect(del.status).toBe(204);
    expect(await User.countDocuments({ _id: a.user.id })).toBe(0);
    expect(await Task.countDocuments({ userId: a.user.id })).toBe(0);
    expect((await api.post("/auth/refresh").send({ refreshToken: a.refreshToken })).status).toBe(401);
    expect((await api.post("/auth/refresh").send({ refreshToken: second.refreshToken })).status).toBe(401);
    expect((await api.post("/auth/login").send(creds(email))).status).toBe(401);
    expect(await Task.countDocuments({ userId: b.user.id })).toBe(1); // B untouched
    expect((await api.get("/tasks").set(bearer(b.accessToken))).body.tasks).toHaveLength(1);
  });

  it("a still-valid access token cannot create tasks for a deleted account (no orphan data)", async () => {
    const a = await signup(api);
    expect((await api.delete("/auth/account").set(bearer(a.accessToken)).send({ password: "Passw0rdOK" })).status).toBe(204);
    const create = await api.post("/tasks").set(bearer(a.accessToken)).send({ title: "orphan" });
    expect(create.status).toBe(401);
    expect(await Task.countDocuments({ title: "orphan" })).toBe(0);
  });

  it("is idempotent-safe: deleting twice does not error out in a confusing way", async () => {
    const a = await signup(api);
    await api.delete("/auth/account").set(bearer(a.accessToken)).send({ password: "Passw0rdOK" });
    const again = await api.delete("/auth/account").set(bearer(a.accessToken)).send({ password: "Passw0rdOK" });
    expect(again.status).toBe(401);
    expect(again.body.error.code).toBe("unauthorized");
  });
});
