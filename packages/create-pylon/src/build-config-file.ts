import type { Answers, IrisDriver, ProteusDriver } from "./types.js";

const proteusFields = (driver: ProteusDriver): Array<string> => {
  switch (driver) {
    case "postgres":
      return [`  postgresUrl: z.string(),`];
    case "mysql":
      return [`  mysqlUrl: z.string(),`];
    case "mongo":
      return [`  mongoUrl: z.string(),`];
    case "redis":
      return [`  redisUrl: z.string(),`];
    case "sqlite":
      return [`  sqlitePath: z.string(),`];
    case "memory":
      return [];
  }
};

const irisFields = (driver: IrisDriver): Array<string> => {
  switch (driver) {
    case "kafka":
      return [`  kafkaBrokers: z.string().transform((s) => s.split(",")),`];
    case "nats":
      return [`  natsServers: z.string(),`];
    case "rabbit":
      return [`  rabbitUrl: z.string(),`];
    case "redis":
      return [`  redisUrl: z.string(),`];
    case "none":
    default:
      return [];
  }
};

export const buildConfigFile = (answers: Answers): string => {
  const lines: Array<string> = [
    `import { configuration } from "@lindorm/config";`,
    `import { z } from "zod";`,
    ``,
    `export const config = configuration({`,
    `  nodeEnv: z`,
    `    .enum(["production", "staging", "development", "test", "unknown"])`,
    `    .default("development"),`,
    `  pylon: z.object({ kek: z.string() }),`,
    `  server: z.object({ port: z.number() }),`,
    `  logger: z.object({`,
    `    level: z`,
    `      .enum(["error", "warn", "info", "verbose", "debug", "silly"])`,
    `      .default("info"),`,
    `  }),`,
  ];

  const emitted = new Set<string>();

  const pushUnique = (entries: ReadonlyArray<string>): void => {
    for (const entry of entries) {
      if (emitted.has(entry)) continue;
      emitted.add(entry);
      lines.push(entry);
    }
  };

  for (const driver of answers.proteusDrivers) {
    pushUnique(proteusFields(driver));
  }

  pushUnique(irisFields(answers.irisDriver));

  if (answers.features.auth) {
    lines.push(`  authClientId: z.string(),`);
    lines.push(`  authClientSecret: z.string(),`);
    lines.push(`  authIssuer: z.string(),`);
  }

  lines.push(`});`, ``);

  return lines.join("\n");
};
