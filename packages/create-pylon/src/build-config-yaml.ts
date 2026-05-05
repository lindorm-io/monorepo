import type { Answers, IrisDriver, ProteusDriver } from "./types.js";

type EnvHint = { path: string; envVar: string };

const schemaFlagHints = (
  prefix: "postgres" | "mysql" | "mongo" | "sqlite",
): Array<EnvHint> => {
  const upper = prefix.toUpperCase();
  return [
    { path: `${prefix}.synchronize`, envVar: `${upper}__SYNCHRONIZE` },
    { path: `${prefix}.migrations`, envVar: `${upper}__MIGRATIONS` },
  ];
};

const proteusEnvHints = (driver: ProteusDriver): Array<EnvHint> => {
  switch (driver) {
    case "postgres":
      return [
        { path: "postgres.url", envVar: "POSTGRES__URL" },
        ...schemaFlagHints("postgres"),
      ];
    case "mysql":
      return [{ path: "mysql.url", envVar: "MYSQL__URL" }, ...schemaFlagHints("mysql")];
    case "mongo":
      return [{ path: "mongo.url", envVar: "MONGO__URL" }, ...schemaFlagHints("mongo")];
    case "redis":
      return [{ path: "redis.url", envVar: "REDIS__URL" }];
    case "sqlite":
      return [
        { path: "sqlite.path", envVar: "SQLITE__PATH" },
        ...schemaFlagHints("sqlite"),
      ];
    case "memory":
      return [];
  }
};

const irisEnvHints = (driver: IrisDriver): Array<EnvHint> => {
  switch (driver) {
    case "kafka":
      return [{ path: "kafka.brokers", envVar: "KAFKA__BROKERS" }];
    case "nats":
      return [{ path: "nats.servers", envVar: "NATS__SERVERS" }];
    case "rabbit":
      return [{ path: "rabbit.url", envVar: "RABBIT__URL" }];
    case "redis":
      return [{ path: "redis.url", envVar: "REDIS__URL" }];
    case "none":
      return [];
  }
};

const dedupByPath = (hints: ReadonlyArray<EnvHint>): Array<EnvHint> => {
  const seen = new Set<string>();
  const out: Array<EnvHint> = [];
  for (const h of hints) {
    if (seen.has(h.path)) continue;
    seen.add(h.path);
    out.push(h);
  }
  return out;
};

const collectHints = (answers: Answers): Array<EnvHint> => {
  const hints: Array<EnvHint> = [
    { path: "nodeEnv", envVar: "NODE_ENV" },
    { path: "pylon.kek", envVar: "PYLON__KEK" },
    { path: "server.port", envVar: "SERVER__PORT" },
    { path: "logger.level", envVar: "LOGGER__LEVEL" },
    { path: "logger.readable", envVar: "LOGGER__READABLE" },
  ];
  for (const driver of answers.proteusDrivers) {
    hints.push(...proteusEnvHints(driver));
  }
  if (answers.irisDriver !== "none") {
    hints.push(...irisEnvHints(answers.irisDriver));
  }
  if (answers.features.auth) {
    hints.push(
      { path: "auth.clientId", envVar: "AUTH__CLIENT_ID" },
      { path: "auth.clientSecret", envVar: "AUTH__CLIENT_SECRET" },
      { path: "auth.issuer", envVar: "AUTH__ISSUER" },
    );
  }
  return dedupByPath(hints);
};

const SCHEMA_MANAGED: ReadonlyArray<ProteusDriver> = [
  "postgres",
  "mysql",
  "sqlite",
  "mongo",
];

const proteusDefaultsBlock = (driver: ProteusDriver): YamlBlock => {
  if (!SCHEMA_MANAGED.includes(driver)) return [];
  return [`${driver}:`, `  synchronize: false`, `  migrations: false`];
};

/**
 * Generates `config/default.yml` for a freshly scaffolded service.
 *
 * Role: cross-environment, non-secret defaults a dev can edit. The
 * header maps every env-var the service's schema responds to so the
 * full contract is discoverable. Per-environment overrides (dev URLs,
 * test config) live in `config/{NODE_ENV}.yml`; secrets live in `.env`.
 */
export const buildConfigYaml = (answers: Answers): string => {
  const unique = collectHints(answers);
  const widest = unique.reduce((max, h) => Math.max(max, h.path.length), 0);

  const lines: Array<string> = [
    `# Default configuration loaded by @lindorm/config.`,
    `#`,
    `# Resolution order (later wins):`,
    `#   1. config/default.yml      (this file — all environments)`,
    `#   2. config/{NODE_ENV}.yml   (per-environment overrides)`,
    `#   3. NODE_CONFIG             (a JSON blob in one env var)`,
    `#   4. process.env             schema-driven, named SCHEMA__PATH__SEGMENT`,
    `#                              (CONSTANT_CASE per segment, joined by __)`,
    `#`,
    `# Sensitive values (KEK, OIDC client secret) live in .env locally and in`,
    `# your secret store (Kubernetes Secrets, Vault, AWS SM, etc.) in`,
    `# production. Dev-only credentials that match docker-compose live in`,
    `# config/development.yml.`,
    `#`,
    `# Env-var override reference for this service:`,
    ...unique.map((h) => `#   ${h.path.padEnd(widest)}  ${h.envVar}`),
    ``,
    `server:`,
    `  port: 3000`,
    ``,
    `logger:`,
    `  level: info`,
    `  readable: false`,
    ``,
  ];

  const seenDefaultKeys = new Set<string>();
  for (const driver of answers.proteusDrivers) {
    const block = proteusDefaultsBlock(driver);
    if (block.length === 0) continue;
    const key = block[0];
    if (seenDefaultKeys.has(key)) continue;
    seenDefaultKeys.add(key);
    lines.push(...block, ``);
  }

  return lines.join("\n");
};

type YamlBlock = Array<string>;

const proteusDevYaml = (driver: ProteusDriver): YamlBlock => {
  switch (driver) {
    case "postgres":
      return [
        `postgres:`,
        `  url: postgresql://postgres:postgres@localhost:5432/app`,
        `  synchronize: true`,
      ];
    case "mysql":
      return [
        `mysql:`,
        `  url: mysql://root:root@localhost:3306/app`,
        `  synchronize: true`,
      ];
    case "mongo":
      return [`mongo:`, `  url: mongodb://localhost:27017/app`, `  synchronize: true`];
    case "redis":
      return [`redis:`, `  url: redis://localhost:6379`];
    case "sqlite":
      return [`sqlite:`, `  path: ./data/app.db`, `  synchronize: true`];
    case "memory":
      return [];
  }
};

const irisDevYaml = (driver: IrisDriver): YamlBlock => {
  switch (driver) {
    case "kafka":
      return [`kafka:`, `  brokers:`, `    - localhost:9092`];
    case "nats":
      return [`nats:`, `  servers: nats://localhost:4222`];
    case "rabbit":
      return [`rabbit:`, `  url: amqp://guest:guest@localhost:5672`];
    case "redis":
      return [`redis:`, `  url: redis://localhost:6379`];
    case "none":
      return [];
  }
};

/**
 * Generates `config/development.yml` for a freshly scaffolded service.
 *
 * Role: dev-only defaults that line up with `docker-compose.yml`, so
 * `npm run docker:up && npm run dev` works without anyone manually
 * filling in URLs. This file is committed — secrets that are *not*
 * dev-only (KEK, OIDC client secret) stay out of it.
 *
 * Driver URLs duplicate the credentials baked into the docker-compose
 * blocks (`postgres:postgres`, `root:root`, `guest:guest`). Override
 * via env (`POSTGRES__URL=...`) or in `config/{NODE_ENV}.yml` if your
 * docker-compose deviates.
 */
export const buildConfigDevelopmentYaml = (answers: Answers): string => {
  const seenKeys = new Set<string>();
  const blocks: Array<YamlBlock> = [];

  const pushBlock = (block: YamlBlock): void => {
    if (block.length === 0) return;
    const key = block[0];
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    blocks.push(block);
  };

  for (const driver of answers.proteusDrivers) {
    pushBlock(proteusDevYaml(driver));
  }
  if (answers.irisDriver !== "none") {
    pushBlock(irisDevYaml(answers.irisDriver));
  }

  const lines: Array<string> = [
    `# Overrides applied when NODE_ENV=development.`,
    `# Merged on top of default.yml — only list the keys you want to change.`,
    `#`,
    `# Driver URLs here line up with the credentials in docker-compose.yml.`,
    `# Override per-developer via .env (which is gitignored).`,
    ``,
    `logger:`,
    `  level: debug`,
    `  readable: true`,
    ``,
  ];

  for (const block of blocks) {
    lines.push(...block, ``);
  }

  return lines.join("\n");
};
