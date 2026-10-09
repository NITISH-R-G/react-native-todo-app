/**
 * Local development only: runs a real mongod (mongodb-memory-server) with an on-disk data dir,
 * generates JWT secrets once into .devdata/ (gitignored), then starts the normal server.
 * Production uses src/server.ts with real environment variables instead.
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";

const dir = ".devdata";
mkdirSync(`${dir}/db`, { recursive: true });
const secretsFile = `${dir}/secrets.json`;
if (!existsSync(secretsFile)) {
  writeFileSync(secretsFile, JSON.stringify({ a: randomBytes(32).toString("hex"), r: randomBytes(32).toString("hex") }));
}
const s = JSON.parse(readFileSync(secretsFile, "utf8")) as { a: string; r: string };

const mongod = await MongoMemoryServer.create({ instance: { dbPath: `${dir}/db`, storageEngine: "wiredTiger", port: 27018 } });
process.env["MONGODB_URI"] = mongod.getUri("todo_dev");
process.env["JWT_ACCESS_SECRET"] = s.a;
process.env["JWT_REFRESH_SECRET"] = s.r;
process.env["PORT"] ??= "4000";
process.env["AUTH_RATE_LIMIT_MAX"] ??= "1000"; // dev/testing only
console.log("dev mongod:", process.env["MONGODB_URI"]);
await import("../src/server.js");
