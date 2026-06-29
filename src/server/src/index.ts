import { mkdirSync } from "node:fs";
import { createApp } from "./app.js";
import { closeDb, getDb } from "./common/db/client.js";
import { runMigrations } from "./common/db/migrate.js";
import { startMcpServer } from "./common/mcp/server.js";

export interface ServerOptions {
  port?: number;
  host?: string;
  dataDir?: string;
}

export async function startServer(options: ServerOptions = {}): Promise<void> {
  const port = options.port ?? Number(process.env.PORT ?? "5610");
  const host = options.host ?? process.env.HOST ?? "127.0.0.1";
  const dataDir = options.dataDir ?? process.env.DATA_DIR ?? `${process.env.HOME}/.gomustack`;

  process.env.DATA_DIR = dataDir;
  mkdirSync(dataDir, { recursive: true });

  // Run DB migrations
  runMigrations(dataDir);

  // Initialize DB singleton
  getDb(dataDir);

  const app = await createApp();

  try {
    await app.listen({ port, host });
    console.log(`\n🚀 GomuStack API running at http://${host}:${port}`);
    if (process.env.NODE_ENV !== "development") {
      console.log(`   Web UI   : http://${host}:${port}/ui`);
    }
    console.log(`   Data dir  : ${dataDir}`);
    console.log(`   Health    : http://${host}:${port}/api/health`);
    console.log(`   S3 API   : http://${host}:${port}/s3 (path-style)\n`);
  } catch (err) {
    console.error("[Server] Failed to start:", err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n[Server] Shutting down...");

    await app.close();
    closeDb();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

export { startMcpServer };

// ─── Direct run ───────────────────────────────────────────────────────────────
if (import.meta.main) {
  startServer();
}
