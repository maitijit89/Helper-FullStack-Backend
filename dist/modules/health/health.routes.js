"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = void 0;
const express_1 = require("express");
const health_controller_1 = require("./health.controller");
const router = (0, express_1.Router)();
router.get("/", health_controller_1.healthController.checkHealth);
exports.healthRoutes = router;
//# sourceMappingURL=health.routes.js.map