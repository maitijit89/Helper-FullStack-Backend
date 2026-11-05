export interface Config {
  env: "development" | "production" | "test";
  port: number;
  apiPrefix: string;
  corsOrigin: string;
}

export const config: Config = {
  env: (process.env.NODE_ENV as Config["env"]) || "development",
  port: Number(process.env.PORT) || 3000,
  apiPrefix: process.env.API_PREFIX || "/api/v1",
  corsOrigin: process.env.CORS_ORIGIN || "*",
};

