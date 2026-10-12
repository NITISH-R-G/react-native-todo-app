import type { Server } from "node:http";
import mongoose from "mongoose";
import type { Config } from "./config.js";
import { createApp } from "./app.js";
import { Task } from "./models/Task.js";
import { User } from "./models/User.js";

/** Removes credentials from any text that contains a MongoDB connection string. */
export function redactMongoUri(text: string): string {
  return text.replace(/mongodb(\+srv)?:\/\/[^@\s/]*@/gi, "mongodb$1://***@");
}

export interface RunningServer {
  port: number;
  /** Stops accepting connections, waits for in-flight requests (bounded), then closes MongoDB. Idempotent. */
  close: () => Promise<void>;
}

/**
 * Connects to MongoDB, ensures indexes, then starts listening. Fails fast with a sanitized error
 * (never the connection string or its credentials) so a misconfigured deployment is obvious in the logs.
 */
export async function startServer(cfg: Config, opts: { shutdownTimeoutMs?: number } = {}): Promise<RunningServer> {
  try {
    await mongoose.connect(cfg.mongoUri, { serverSelectionTimeoutMS: cfg.mongoServerSelectionTimeoutMs });
    await Promise.all([User.init(), Task.init()]); // indexes (unique email) must exist before serving
  } catch (e) {
    await mongoose.disconnect().catch(() => undefined);
    throw new Error(`MongoDB startup failed: ${redactMongoUri(e instanceof Error ? e.message : String(e))}`);
  }
  mongoose.connection.on("disconnected", () => console.error("mongodb disconnected"));
  mongoose.connection.on("reconnected", () => console.log("mongodb reconnected"));

  const app = createApp(cfg, {
    isReady: async () => {
      if (mongoose.connection.readyState !== 1) return false;
      await mongoose.connection.db?.admin().ping();
      return true;
    },
  });
  const server: Server = await new Promise((resolve, reject) => {
    const s = app.listen(cfg.port, () => resolve(s));
    s.once("error", reject);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : cfg.port;

  let closing: Promise<void> | null = null;
  const close = () =>
    (closing ??= (async () => {
      const timeout = opts.shutdownTimeoutMs ?? 10_000;
      await new Promise<void>((resolve) => {
        const force = setTimeout(() => {
          server.closeAllConnections(); // keep-alive sockets must not hold shutdown hostage
          resolve();
        }, timeout);
        server.close(() => {
          clearTimeout(force);
          resolve();
        });
        server.closeIdleConnections();
      });
      await mongoose.disconnect();
    })());
  return { port, close };
}
