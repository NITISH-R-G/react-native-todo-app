import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import type { Config } from "../src/config.js";
import { User } from "../src/models/User.js";
import { Task } from "../src/models/Task.js";

// Real mongod (mongodb-memory-server) + real HTTP parsing via supertest. No mocks of app code.
const cfg: Config = {
  port: 0,
  mongoUri: "",
  accessSecret: "a".repeat(40),
  refreshSecret: "b".repeat(40),
  accessTtl: "15m",
  refreshTtl: "30d",
  corsOrigins: [],
  authRateLimit: null,
};
let mongod: MongoMemoryServer;
let api: ReturnType<typeof request>;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("todo_test"));
  await Promise.all([User.init(), Task.init()]);
  api = request(createApp(cfg));
}, 300_000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Task.deleteMany({})]);
});

const creds = (email = "a@example.com") => ({ email, password: "Passw0rdOK" });
async function signup(email?: string) {
  const res = await api.post("/auth/register").send(creds(email));
  expect(res.status).toBe(201);
  return { token: res.body.accessToken as string, refresh: res.body.refreshToken as string, id: res.body.user.id as string };
}
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("auth (AUTH-001/002/003, SEC-001)", () => {
  it("registers, stores only an argon2 hash, and logs in with the same credentials", async () => {
    await signup();
    const stored = await User.findOne({ email: "a@example.com" }).lean();
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(JSON.stringify(stored)).not.toContain("Passw0rdOK");
    const login = await api.post("/auth/login").send(creds());
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTruthy();
  });

  it("normalises email case so a differently-cased duplicate is rejected with 409", async () => {
    await signup("a@example.com");
    const dup = await api.post("/auth/register").send(creds("A@Example.com"));
    expect(dup.status).toBe(409);
  });

  it("concurrent duplicate registrations produce exactly one account (race-safe)", async () => {
    const rs = await Promise.all([1, 2, 3].map(() => api.post("/auth/register").send(creds("race@example.com"))));
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await User.countDocuments({ email: "race@example.com" })).toBe(1);
  });

  it.each([
    ["malformed email", { email: "not-an-email", password: "Passw0rdOK" }],
    ["short password", { email: "x@example.com", password: "a1" }],
    ["no digit", { email: "x@example.com", password: "onlyletters" }],
    ["missing password", { email: "x@example.com" }],
    ["unknown field", { email: "x@example.com", password: "Passw0rdOK", isAdmin: true }],
  ])("rejects registration: %s", async (_n, body) => {
    const res = await api.post("/auth/register").send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("gives the same error for wrong password and unknown email", async () => {
    await signup();
    const wrong = await api.post("/auth/login").send({ email: "a@example.com", password: "WrongPass1" });
    const unknown = await api.post("/auth/login").send({ email: "nobody@example.com", password: "WrongPass1" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("rotates refresh tokens: reuse of the old one is rejected", async () => {
    const { refresh } = await signup();
    const first = await api.post("/auth/refresh").send({ refreshToken: refresh });
    expect(first.status).toBe(200);
    const reuse = await api.post("/auth/refresh").send({ refreshToken: refresh });
    expect(reuse.status).toBe(401);
    const second = await api.post("/auth/refresh").send({ refreshToken: first.body.refreshToken });
    expect(second.status).toBe(200);
  });

  it("rejects an access token used as a refresh token", async () => {
    const { token } = await signup();
    expect((await api.post("/auth/refresh").send({ refreshToken: token })).status).toBe(401);
  });
});

describe("authorisation boundary (API-001)", () => {
  it("rejects missing, forged, wrong-type and expired tokens", async () => {
    const { id } = await signup();
    expect((await api.get("/tasks")).status).toBe(401);
    expect((await api.get("/tasks").set(bearer("garbage"))).status).toBe(401);
    const forged = jwt.sign({ typ: "access" }, "c".repeat(40), { subject: id });
    expect((await api.get("/tasks").set(bearer(forged))).status).toBe(401);
    const refreshTyped = jwt.sign({ typ: "refresh" }, cfg.accessSecret, { subject: id });
    expect((await api.get("/tasks").set(bearer(refreshTyped))).status).toBe(401);
    const expired = jwt.sign({ typ: "access" }, cfg.accessSecret, { subject: id, expiresIn: -10 });
    const res = await api.get("/tasks").set(bearer(expired));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("token_expired");
  });
});

describe("task lifecycle and persistence (TASK-001..006, DATA-001)", () => {
  it("create -> fetch -> complete -> fresh fetch -> delete -> absent", async () => {
    const { token } = await signup();
    const created = await api
      .post("/tasks")
      .set(bearer(token))
      .send({ title: "  Write report ", description: "q3", startAt: "2030-01-01T09:00:00Z", deadline: "2030-01-02T09:00:00Z", priority: "high", tags: ["Work", "work", "q3"] });
    expect(created.status).toBe(201);
    const id = created.body.task.id as string;
    expect(created.body.task).toMatchObject({ title: "Write report", priority: "high", completed: false, overdue: false, tags: ["work", "q3"] });

    // Server persistence is the source of truth: read straight from MongoDB, bypassing the API.
    const raw = await Task.findById(id).lean();
    expect(raw?.title).toBe("Write report");

    const done = await api.patch(`/tasks/${id}`).set(bearer(token)).send({ completed: true });
    expect(done.status).toBe(200);
    const fresh = await api.get(`/tasks/${id}`).set(bearer(token));
    expect(fresh.body.task.completed).toBe(true);
    expect(fresh.body.task.completedAt).toBeTruthy();

    const undone = await api.patch(`/tasks/${id}`).set(bearer(token)).send({ completed: false });
    expect(undone.body.task.completedAt).toBeNull();

    expect((await api.delete(`/tasks/${id}`).set(bearer(token))).status).toBe(204);
    expect((await api.get(`/tasks/${id}`).set(bearer(token))).status).toBe(404);
    expect((await api.get("/tasks").set(bearer(token))).body.tasks).toHaveLength(0);
    expect(await Task.countDocuments({ _id: id })).toBe(0);
    expect((await api.delete(`/tasks/${id}`).set(bearer(token))).status).toBe(404);
  });

  it("user B cannot read, update, complete or delete user A's task; list is isolated", async () => {
    const a = await signup("a@example.com");
    const b = await signup("b@example.com");
    const t = await api.post("/tasks").set(bearer(a.token)).send({ title: "private" });
    const id = t.body.task.id as string;

    expect((await api.get(`/tasks/${id}`).set(bearer(b.token))).status).toBe(404);
    expect((await api.patch(`/tasks/${id}`).set(bearer(b.token)).send({ completed: true })).status).toBe(404);
    expect((await api.patch(`/tasks/${id}`).set(bearer(b.token)).send({ title: "pwned" })).status).toBe(404);
    expect((await api.delete(`/tasks/${id}`).set(bearer(b.token))).status).toBe(404);
    expect((await api.get("/tasks").set(bearer(b.token))).body.tasks).toHaveLength(0);

    const still = await Task.findById(id).lean();
    expect(still?.title).toBe("private");
    expect(still?.completed).toBe(false);
  });

  it("ignores a client-supplied userId by rejecting unknown fields", async () => {
    const a = await signup("a@example.com");
    const b = await signup("b@example.com");
    const res = await api.post("/tasks").set(bearer(a.token)).send({ title: "x", userId: b.id });
    expect(res.status).toBe(400);
  });

  it.each([
    ["empty title", { title: "   " }],
    ["missing title", {}],
    ["invalid date string", { title: "x", startAt: "tomorrow" }],
    ["deadline before start", { title: "x", startAt: "2030-01-02T00:00:00Z", deadline: "2030-01-01T00:00:00Z" }],
    ["bad priority", { title: "x", priority: "urgent" }],
    ["too many tags", { title: "x", tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }],
  ])("rejects create: %s", async (_n, body) => {
    const { token } = await signup();
    expect((await api.post("/tasks").set(bearer(token)).send(body)).status).toBe(400);
  });

  it("accepts a past deadline and reports it as overdue (documented behaviour)", async () => {
    const { token } = await signup();
    const res = await api.post("/tasks").set(bearer(token)).send({ title: "late", startAt: "2020-01-01T00:00:00Z", deadline: "2020-01-02T00:00:00Z" });
    expect(res.status).toBe(201);
    expect(res.body.task.overdue).toBe(true);
  });

  it("enforces deadline >= startAt on partial updates against stored values", async () => {
    const { token } = await signup();
    const t = await api.post("/tasks").set(bearer(token)).send({ title: "x", startAt: "2030-01-05T00:00:00Z" });
    const res = await api.patch(`/tasks/${t.body.task.id}`).set(bearer(token)).send({ deadline: "2030-01-01T00:00:00Z" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for malformed ids and 400 for malformed JSON", async () => {
    const { token } = await signup();
    expect((await api.get("/tasks/not-an-id").set(bearer(token))).status).toBe(404);
    const bad = await api.post("/tasks").set(bearer(token)).set("Content-Type", "application/json").send("{oops");
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("bad_json");
  });

  it("lists sorted by the smart order and supports status/priority/tag filters", async () => {
    const { token } = await signup();
    const post = (b: object) => api.post("/tasks").set(bearer(token)).send(b);
    const soon = new Date(Date.now() + 3_600_000).toISOString();
    await post({ title: "low-nodl", priority: "low", tags: ["home"] });
    await post({ title: "high-soon", priority: "high", deadline: soon, startAt: new Date().toISOString() });
    const done = await post({ title: "finished", priority: "high" });
    await api.patch(`/tasks/${done.body.task.id}`).set(bearer(token)).send({ completed: true });

    const all = await api.get("/tasks").set(bearer(token));
    expect(all.body.tasks.map((t: { title: string }) => t.title)).toEqual(["high-soon", "low-nodl", "finished"]);
    const active = await api.get("/tasks?status=active&tag=home").set(bearer(token));
    expect(active.body.tasks.map((t: { title: string }) => t.title)).toEqual(["low-nodl"]);
    expect((await api.get("/tasks?priority=high&status=completed").set(bearer(token))).body.tasks).toHaveLength(1);
    expect((await api.get("/tasks?sort=bogus").set(bearer(token))).status).toBe(400);
  });
});
