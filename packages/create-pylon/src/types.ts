export type ProteusDriver =
  | "none"
  | "memory"
  | "mongo"
  | "mysql"
  | "postgres"
  | "redis"
  | "sqlite";

export type IrisDriver = "none" | "kafka" | "nats" | "rabbit" | "redis";

export type WorkerKey = "amphora-entity-sync" | "expiry-cleanup" | "kryptos-rotation";

export type Features = {
  http: boolean;
  socket: boolean;
  webhooks: boolean;
  audit: boolean;
  session: boolean;
  auth: boolean;
  rateLimit: boolean;
};

export type Answers = {
  projectName: string;
  projectDir: string;
  features: Features;
  proteusDriver: ProteusDriver;
  irisDriver: IrisDriver;
  workers: Array<WorkerKey>;
};

export const PROTEUS_DRIVER_PACKAGES: Record<ProteusDriver, Array<string>> = {
  none: [],
  memory: [],
  mongo: ["mongodb"],
  mysql: ["mysql2"],
  postgres: ["pg"],
  redis: ["ioredis"],
  sqlite: ["better-sqlite3"],
};

export const PROTEUS_DRIVER_DEV_PACKAGES: Record<ProteusDriver, Array<string>> = {
  none: [],
  memory: [],
  mongo: [],
  mysql: [],
  postgres: ["@types/pg"],
  redis: [],
  sqlite: ["@types/better-sqlite3"],
};

export const IRIS_DRIVER_PACKAGES: Record<IrisDriver, Array<string>> = {
  none: [],
  kafka: ["kafkajs"],
  nats: ["nats"],
  rabbit: ["amqplib"],
  redis: ["ioredis"],
};

export const IRIS_DRIVER_DEV_PACKAGES: Record<IrisDriver, Array<string>> = {
  none: [],
  kafka: [],
  nats: [],
  rabbit: ["@types/amqplib"],
  redis: [],
};

export type EnvEntry = { key: string; value: string };

export const PROTEUS_ENV_VARS: Record<ProteusDriver, Array<EnvEntry>> = {
  none: [],
  memory: [],
  mongo: [{ key: "PROTEUS_URL", value: "mongodb://localhost:27017/app" }],
  mysql: [{ key: "PROTEUS_URL", value: "mysql://localhost:3306/app" }],
  postgres: [{ key: "PROTEUS_URL", value: "postgresql://localhost:5432/app" }],
  redis: [{ key: "PROTEUS_URL", value: "redis://localhost:6379" }],
  sqlite: [{ key: "PROTEUS_URL", value: "file:./data/app.db" }],
};

export const IRIS_ENV_VARS: Record<IrisDriver, Array<EnvEntry>> = {
  none: [],
  kafka: [{ key: "IRIS_BROKERS", value: "localhost:9092" }],
  nats: [{ key: "IRIS_SERVERS", value: "localhost:4222" }],
  rabbit: [{ key: "IRIS_URL", value: "amqp://localhost:5672" }],
  redis: [{ key: "IRIS_URL", value: "redis://localhost:6379" }],
};

export const AUTH_ENV_VARS: ReadonlyArray<EnvEntry> = [
  { key: "AUTH_CLIENT_ID", value: "" },
  { key: "AUTH_CLIENT_SECRET", value: "" },
  { key: "AUTH_ISSUER", value: "https://auth.example.com" },
];

export const PROTEUS_DEPENDENT_WORKERS: ReadonlyArray<WorkerKey> = [
  "amphora-entity-sync",
  "expiry-cleanup",
  "kryptos-rotation",
];

export const BASE_RUNTIME_DEPENDENCIES: ReadonlyArray<string> = [
  "@lindorm/pylon",
  "@lindorm/amphora",
  "@lindorm/errors",
  "@lindorm/logger",
  "@lindorm/types",
  "@lindorm/worker",
  "@lindorm/config",
  "zod",
];

export const BASE_DEV_DEPENDENCIES: ReadonlyArray<string> = [
  "@types/jest",
  "@types/node",
  "@types/supertest",
  "globals",
  "jest",
  "mockdate",
  "nock",
  "supertest",
  "ts-jest",
  "tsx",
  "typescript",
];
