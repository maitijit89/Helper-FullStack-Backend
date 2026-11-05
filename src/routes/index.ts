import { Router } from "express";
import { healthRoutes } from "../modules/health/health.routes";
import { userRoutes } from "../modules/users/user.routes";

const router = Router();

// Module Routes
router.use("/health", healthRoutes);
router.use("/users", userRoutes);

export const apiRouter = router;

