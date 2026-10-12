import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { redactMongoUri, startServer } from "../src/lifecycle.js";
import { testConfig } from "./helpers.js";

// Startup, readiness and shutdown behaviour of the production entry path (src/lifecycle.ts), against a real mongod.
let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); }, 300_000);
afterAll(async () => { await mongod.stop(); });

describe("startup failure", () => {
  it("an unreachable database fails fast and the error never contains the credentials", async () => {
    const cfg = testConfig({ mongoUri: "mongodb://appuser:TopSecretPw9@127.0.0.1:1/todo", mongoServerSelectionTimeoutMs: 600 });
    const err = await startServer(cfg).then(() => null, (e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err!.message).toMatch(/MongoDB startup failed/);
    expect(err!.message).not.toContain("TopSecretPw9");
    expect(err!.message).not.toContain("appuser");
  });

  it("redactMongoUri strips credentials from plain and SRV connection strings anywhere in a message", () => {
    expect(redactMongoUri("fail mongodb://u:p%40ss@host1:27017,host2/db?x=1 end")).toBe("fail mongodb://***@host1:27017,host2/db?x=1 end");
    expect(redactMongoUri("mongodb+srv://u:p@cluster0.abc.mongodb.net/x")).toBe("mongodb+srv://***@cluster0.abc.mongodb.net/x");
    expect(redactMongoUri("no secrets here")).toBe("no secrets here");
  });
});

describe("running server", () => {
  it("is ready only while MongoDB answers, and shuts down gracefully (idempotent close)", async () => {
    const running = await startServer(testConfig({ mongoUri: mongod.getUri("life_test") }), { shutdownTimeoutMs: 3000 });
    const base = `http://127.0.0.1:${running.port}`;
    expect((await fetch(`${base}/health`)).status).toBe(200);
    expect(await (await fetch(`${base}/ready`)).json()).toEqual({ ready: true });

    // unique-email index exists before the first request is served
    const indexes = await mongoose.connection.collection("users").indexes();
    expect(indexes.some((i) => i.unique && (i.key as Record<string, number>)["email"] === 1)).toBe(true);

    await Promise.all([running.close(), running.close()]); // concurrent + repeated close is safe
    await expect(fetch(`${base}/health`)).rejects.toThrow(); // no longer listening
    expect(mongoose.connection.readyState).toBe(0); // database connection released
  });

  it("reports not-ready (503) when the database goes away, while liveness stays 200", async () => {
    const own = await MongoMemoryServer.create();
    const running = await startServer(testConfig({ mongoUri: own.getUri("life_test2"), mongoServerSelectionTimeoutMs: 800 }), { shutdownTimeoutMs: 1000 });
    const base = `http://127.0.0.1:${running.port}`;
    expect((await fetch(`${base}/ready`)).status).toBe(200);
    await own.stop();
    let status = 200;
    for (let i = 0; i < 20 && status === 200; i++) {
      await new Promise((r) => setTimeout(r, 300));
      status = (await fetch(`${base}/ready`)).status;
    }
    expect(status).toBe(503);
    expect((await fetch(`${base}/health`)).status).toBe(200);
    await running.close();
  });
});
