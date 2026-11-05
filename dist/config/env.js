"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
    env: process.env.NODE_ENV || "development",
    port: Number(process.env.PORT) || 3000,
    apiPrefix: process.env.API_PREFIX || "/api/v1",
    corsOrigin: process.env.CORS_ORIGIN || "*",
};
//# sourceMappingURL=env.js.map