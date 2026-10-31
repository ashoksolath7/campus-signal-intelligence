export type MongoHealth = {
  status: "connected" | "disconnected" | "not_configured" | string;
  configured?: boolean;
  database?: string;
};

export type HealthResponse = {
  status: "ok";
  service: string;
  version: string;
  environment: string;
  mongodb: MongoHealth;
};
