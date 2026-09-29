import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { connectDB, assertReplicaSet } from "./config/db";
import { initSocketServer } from "./realtime/socketServer";

async function main() {
  await connectDB();
  await assertReplicaSet();

  const app = createApp();
  const httpServer = http.createServer(app);
  initSocketServer(httpServer);

  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `[server] Port ${env.port} is already in use. Kill the existing process and retry.`,
      );
      process.exit(1);
    } else {
      throw err;
    }
  });

  httpServer.listen(env.port, () => {
    console.log(
      `[server] Parking system API listening on port ${env.port} (${env.nodeEnv})`,
    );
  });

  const shutdown = (signal: string) => {
    console.log(`[server] Received ${signal}, shutting down gracefully...`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[server] Fatal startup error", err);
  process.exit(1);
});
