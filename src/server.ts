import { app } from "./app";
import { config } from "./config/env";
import { Server } from "http";

let server: Server;

const startServer = () => {
  server = app.listen(config.port, () => {
    console.log(
      `🚀 [Server] Running in ${config.env} mode on http://localhost:${config.port}`
    );
    console.log(
      `🔗 [API] Health check available at http://localhost:${config.port}${config.apiPrefix}/health`
    );
  });
};

const handleGracefulShutdown = (signal: string) => {
  console.log(`\n🛑 [Server] Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close((err) => {
      if (err) {
        console.error("❌ [Server] Error during shutdown:", err);
        process.exit(1);
      }
      console.log("✅ [Server] Connections closed. Exiting process.");
      process.exit(0);
    });

    // Force shutdown after timeout if pending requests do not resolve
    setTimeout(() => {
      console.error("⚠️ [Server] Forced shutdown due to timeout.");
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
};

process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason: unknown) => {
  console.error("💥 [Process] Unhandled Promise Rejection:", reason);
  // In production, trigger an alert or clean exit
});

process.on("uncaughtException", (error: Error) => {
  console.error("💥 [Process] Uncaught Exception:", error);
  process.exit(1);
});

startServer();

