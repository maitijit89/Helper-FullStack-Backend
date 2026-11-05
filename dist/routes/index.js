"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const health_routes_1 = require("../modules/health/health.routes");
const user_routes_1 = require("../modules/users/user.routes");
const router = (0, express_1.Router)();
// Module Routes
router.use("/health", health_routes_1.healthRoutes);
router.use("/users", user_routes_1.userRoutes);
exports.apiRouter = router;
//# sourceMappingURL=index.js.map