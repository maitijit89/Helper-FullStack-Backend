"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const app_error_1 = require("../errors/app-error");
const env_1 = require("../../config/env");
const errorHandler = (err, req, res, _next) => {
    let statusCode = 500;
    let message = "Internal Server Error";
    if (err instanceof app_error_1.AppError) {
        statusCode = err.statusCode;
        message = err.message;
    }
    else if (err instanceof Error) {
        message = err.message;
    }
    // Structured logging for server errors
    if (statusCode >= 500) {
        console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);
    }
    res.status(statusCode).json({
        success: false,
        statusCode,
        message,
        ...(env_1.config.env === "development" && {
            stack: err instanceof Error ? err.stack : undefined,
        }),
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=error.middleware.js.map