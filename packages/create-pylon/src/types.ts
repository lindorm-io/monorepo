export type ProteusDriver =
  | "memory"
  | "mongo"
  | "mysql"
  | "postgres"
  | "redis"
  | "sqlite";

export type DbDriver = "postgres" | "mysql" | "mongo" | "sqlite" | "memory" | "none";

export type KvDriver = "redis" | "memory" | "none";

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
  issuer: string;
  features: Features;
  db: DbDriver;
  kv: KvDriver;
  irisDriver: IrisDriver;
  workers: Array<WorkerKey>;
};

/**
 * The real Proteus drivers behind the two selects — the db source (if any)
 * followed by the kv source (if any). `none` picks contribute nothing.
 */
export const selectedDrivers = (a: Pick<Answers, "db" | "kv">): Array<ProteusDriver> =>
  [a.db, a.kv].filter((d): d is ProteusDriver => d !== "none");

/**
 * Drivers that represent a DB-style store and therefore benefit from a
 * query cache adapter. Redis, sqlite and memory are themselves fast/local
 * enough that fronting them with a cache is pointless.
 */
export const PROTEUS_DB_DRIVERS: ReadonlyArray<ProteusDriver> = [
  "postgres",
  "mysql",
  "mongo",
];

/**
 * Drivers that manage SQL/MongoDB schemas (DDL migrations + entity-driven
 * synchronization). Redis and memory have no schema to manage.
 */
export const PROTEUS_SCHEMA_MANAGED_DRIVERS: ReadonlyArray<ProteusDriver> = [
  "postgres",
  "mysql",
  "sqlite",
  "mongo",
];

export const PROTEUS_DRIVER_PACKAGES: Record<ProteusDriver, Array<string>> = {
  memory: [],
  mongo: ["mongodb"],
  mysql: ["mysql2"],
  postgres: ["pg"],
  redis: ["ioredis"],
  sqlite: ["better-sqlite3"],
};

export const PROTEUS_DRIVER_DEV_PACKAGES: Record<ProteusDriver, Array<string>> = {
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

// Env-var names follow the @lindorm/config convention: each schema-path
// segment in CONSTANT_CASE, joined by `__`. So `postgres.url` ↔ `POSTGRES__URL`.
// `NODE_ENV` is a deliberate exception — it's a top-level single-segment key
// (`nodeEnv`) so it lands on the universal Node.js env var unchanged.
export const PROTEUS_ENV_VARS: Record<ProteusDriver, Array<EnvEntry>> = {
  memory: [],
  mongo: [{ key: "MONGO__URL", value: "mongodb://localhost:27017/app" }],
  mysql: [{ key: "MYSQL__URL", value: "mysql://localhost:3306/app" }],
  postgres: [{ key: "POSTGRES__URL", value: "postgresql://localhost:5432/app" }],
  redis: [{ key: "REDIS__URL", value: "redis://localhost:6379" }],
  sqlite: [{ key: "SQLITE__PATH", value: "./data/app.db" }],
};

export const IRIS_ENV_VARS: Record<IrisDriver, Array<EnvEntry>> = {
  none: [],
  kafka: [{ key: "KAFKA__BROKERS", value: "localhost:9092" }],
  nats: [{ key: "NATS__SERVERS", value: "localhost:4222" }],
  rabbit: [{ key: "RABBIT__URL", value: "amqp://localhost:5672" }],
  redis: [{ key: "REDIS__URL", value: "redis://localhost:6379" }],
};

export const AUTH_ENV_VARS: ReadonlyArray<EnvEntry> = [
  { key: "AUTH__CLIENT_ID", value: "" },
  { key: "AUTH__CLIENT_SECRET", value: "" },
  { key: "AUTH__ISSUER", value: "https://auth.example.com" },
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
  // Scaffold-only: the generated lindorm.config.ts imports defineConfig from it,
  // and the pylon CLI loads that config (via tsx) at generate-time.
  "@lindorm/scaffold",
  "@types/node",
  "@types/supertest",
  "globals",
  "mockdate",
  "nock",
  "supertest",
  "tsx",
  "typescript",
  "vitest",
];
