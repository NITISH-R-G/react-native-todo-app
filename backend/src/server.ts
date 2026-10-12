import { loadConfig } from "./config.js";
import { redactMongoUri, startServer } from "./lifecycle.js";

/** Production entry point. All configuration comes from environment variables (see .env.example). */
async function main() {
  const cfg = loadConfig();
  const running = await startServer(cfg);
  console.log(`API listening on :${running.port}`);

  let stopping = false;
  const stop = (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`${signal} received, shutting down`);
    running.close().then(
      () => process.exit(0),
      (e) => {
        console.error("shutdown error", redactMongoUri(e instanceof Error ? e.message : String(e)));
        process.exit(1);
      },
    );
  };
  process.on("SIGTERM", () => stop("SIGTERM"));
  process.on("SIGINT", () => stop("SIGINT"));
}

// Log (sanitized) and exit non-zero so the platform restarts the process instead of leaving it half-alive.
process.on("unhandledRejection", (r) => {
  console.error("unhandledRejection", redactMongoUri(r instanceof Error ? r.message : String(r)));
  process.exit(1);
});
process.on("uncaughtException", (e) => {
  console.error("uncaughtException", redactMongoUri(e.message));
  process.exit(1);
});

main().catch((e) => {
  console.error(redactMongoUri(e instanceof Error ? e.message : String(e)));
  process.exit(1);
});
