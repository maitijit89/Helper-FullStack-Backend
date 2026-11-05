"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
let server;
const startServer = () => {
    server = app_1.app.listen(env_1.config.port, () => {
        console.log(`🚀 [Server] Running in ${env_1.config.env} mode on http://localhost:${env_1.config.port}`);
        console.log(`🔗 [API] Health check available at http://localhost:${env_1.config.port}${env_1.config.apiPrefix}/health`);
    });
};
const handleGracefulShutdown = (signal) => {
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
    }
    else {
        process.exit(0);
    }
};
process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
    console.error("💥 [Process] Unhandled Promise Rejection:", reason);
    // In production, trigger an alert or clean exit
});
process.on("uncaughtException", (error) => {
    console.error("💥 [Process] Uncaught Exception:", error);
    process.exit(1);
});
startServer();
//# sourceMappingURL=server.js.map