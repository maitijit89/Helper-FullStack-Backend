"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = void 0;
const express_1 = require("express");
const user_controller_1 = require("./user.controller");
const router = (0, express_1.Router)();
router.get("/", user_controller_1.userController.getAll);
router.get("/:id", user_controller_1.userController.getById);
router.post("/", user_controller_1.userController.create);
router.put("/:id", user_controller_1.userController.update);
router.delete("/:id", user_controller_1.userController.remove);
exports.userRoutes = router;
//# sourceMappingURL=user.routes.js.map