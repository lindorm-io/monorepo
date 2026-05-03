import type { Answers, IrisDriver, ProteusDriver } from "./types.js";

type EnvHint = { path: string; envVar: string };

const proteusEnvHints = (driver: ProteusDriver): Array<EnvHint> => {
  switch (driver) {
    case "postgres":
      return [{ path: "postgres.url", envVar: "POSTGRES__URL" }];
    case "mysql":
      return [{ path: "mysql.url", envVar: "MYSQL__URL" }];
    case "mongo":
      return [{ path: "mongo.url", envVar: "MONGO__URL" }];
    case "redis":
      return [{ path: "redis.url", envVar: "REDIS__URL" }];
    case "sqlite":
      return [{ path: "sqlite.path", envVar: "SQLITE__PATH" }];
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

/**
 * Generates `config/default.yml` for a freshly scaffolded service.
 *
 * The role of this file is twofold:
 *   - It carries the non-secret defaults the service can run with out
 *     of the box (`server.port`, `logger.level`).
 *   - The header is a hand-readable map of every env-var the service's
 *     schema responds to — paths on the left, `__`-joined CONSTANT_CASE
 *     names on the right. Sensitive values (KEK, URLs, client secrets)
 *     are intentionally absent from the YAML; they're sourced from
 *     `.env` locally and from a secret store in production.
 */
export const buildConfigYaml = (answers: Answers): string => {
  const hints: Array<EnvHint> = [
    { path: "nodeEnv", envVar: "NODE_ENV" },
    { path: "pylon.kek", envVar: "PYLON__KEK" },
    { path: "server.port", envVar: "SERVER__PORT" },
    { path: "logger.level", envVar: "LOGGER__LEVEL" },
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

  const unique = dedupByPath(hints);
  const widest = unique.reduce((max, h) => Math.max(max, h.path.length), 0);

  const lines: Array<string> = [
    `# Default configuration loaded by @lindorm/config.`,
    `#`,
    `# Resolution order (later wins):`,
    `#   1. config/default.yml  (this file)`,
    `#   2. config/{NODE_ENV}.yml`,
    `#   3. NODE_CONFIG          (a JSON blob in one env var)`,
    `#   4. process.env          schema-driven, named SCHEMA__PATH__SEGMENT`,
    `#                           (CONSTANT_CASE per segment, joined by __)`,
    `#`,
    `# Sensitive values (KEK, database URLs, OIDC client secrets) belong in`,
    `# .env locally and in your secret store (Kubernetes Secrets, Vault, AWS`,
    `# SM, etc.) in production. Don't commit them here.`,
    `#`,
    `# Env-var override reference for this service:`,
    ...unique.map((h) => `#   ${h.path.padEnd(widest)}  ${h.envVar}`),
    ``,
    `server:`,
    `  port: 3000`,
    ``,
    `logger:`,
    `  level: info`,
    ``,
  ];

  return lines.join("\n");
};
