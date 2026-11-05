"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthController = exports.HealthController = void 0;
const api_response_1 = require("../../shared/utils/api-response");
const env_1 = require("../../config/env");
class HealthController {
    checkHealth = (_req, res) => {
        (0, api_response_1.sendResponse)(res, {
            statusCode: 200,
            message: "Service is healthy and operational",
            data: {
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
                environment: env_1.config.env,
                memoryUsage: process.memoryUsage(),
            },
        });
    };
}
exports.HealthController = HealthController;
exports.healthController = new HealthController();
//# sourceMappingURL=health.controller.js.map