import express, { Application } from "express";
import { config } from "./config/env";
import { apiRouter } from "./routes";
import { notFoundHandler } from "./shared/middlewares/not-found.middleware";
import { errorHandler } from "./shared/middlewares/error.middleware";

export const createApp = (): Application => {
  const app = express();

  // Core Middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Root Welcome Endpoint
  app.get("/", (_req, res) => {
    res.json({
      name: "Helper Backend API",
      status: "running",
      documentation: `${config.apiPrefix}/docs`,
      health: `${config.apiPrefix}/health`,
    });
  });

  // Mount API Features
  app.use(config.apiPrefix, apiRouter);

  // Fallback 404 & Central Error Handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export const app = createApp();
