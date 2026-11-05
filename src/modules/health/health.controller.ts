import { Request, Response } from "express";
import { sendResponse } from "../../shared/utils/api-response";
import { config } from "../../config/env";

export class HealthController {
  public checkHealth = (_req: Request, res: Response): void => {
    sendResponse(res, {
      statusCode: 200,
      message: "Service is healthy and operational",
      data: {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: config.env,
        memoryUsage: process.memoryUsage(),
      },
    });
  };
}

export const healthController = new HealthController();

