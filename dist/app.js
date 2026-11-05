"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const env_1 = require("./config/env");
const routes_1 = require("./routes");
const not_found_middleware_1 = require("./shared/middlewares/not-found.middleware");
const error_middleware_1 = require("./shared/middlewares/error.middleware");
const createApp = () => {
    const app = (0, express_1.default)();
    // Core Middlewares
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: true }));
    // Root Welcome Endpoint
    app.get("/", (_req, res) => {
        res.json({
            name: "Helper Backend API",
            status: "running",
            documentation: `${env_1.config.apiPrefix}/docs`,
            health: `${env_1.config.apiPrefix}/health`,
        });
    });
    // Mount API Features
    app.use(env_1.config.apiPrefix, routes_1.apiRouter);
    // Fallback 404 & Central Error Handling
    app.use(not_found_middleware_1.notFoundHandler);
    app.use(error_middleware_1.errorHandler);
    return app;
};
exports.createApp = createApp;
exports.app = (0, exports.createApp)();
//# sourceMappingURL=app.js.map