import type { Answers, IrisDriver, ProteusDriver } from "./types.js";

type Group = {
  key: string;
  lines: Array<string>;
};

const proteusGroup = (driver: ProteusDriver): Group | null => {
  switch (driver) {
    case "postgres":
      return { key: "postgres", lines: [`    url: z.string(),`] };
    case "mysql":
      return { key: "mysql", lines: [`    url: z.string(),`] };
    case "mongo":
      return { key: "mongo", lines: [`    url: z.string(),`] };
    case "redis":
      return { key: "redis", lines: [`    url: z.string(),`] };
    case "sqlite":
      return { key: "sqlite", lines: [`    path: z.string(),`] };
    case "memory":
      return null;
  }
};

const irisGroup = (driver: IrisDriver): Group | null => {
  switch (driver) {
    case "kafka":
      return {
        key: "kafka",
        lines: [`    brokers: z.string().transform((s) => s.split(",")),`],
      };
    case "nats":
      return { key: "nats", lines: [`    servers: z.string(),`] };
    case "rabbit":
      return { key: "rabbit", lines: [`    url: z.string(),`] };
    case "redis":
      return { key: "redis", lines: [`    url: z.string(),`] };
    case "none":
    default:
      return null;
  }
};

const renderGroup = (group: Group): Array<string> => [
  `  ${group.key}: z.object({`,
  ...group.lines,
  `  }),`,
];

export const buildConfigFile = (answers: Answers): string => {
  const lines: Array<string> = [
    `import { configuration } from "@lindorm/config";`,
    `import { z } from "zod";`,
    ``,
    `export const config = configuration({`,
    `  node: z.object({`,
    `    env: z`,
    `      .enum(["production", "staging", "development", "test", "unknown"])`,
    `      .default("development"),`,
    `  }),`,
    `  pylon: z.object({ kek: z.string() }),`,
    `  server: z.object({ port: z.number() }),`,
    `  logger: z.object({`,
    `    level: z`,
    `      .enum(["error", "warn", "info", "verbose", "debug", "silly"])`,
    `      .default("info"),`,
    `  }),`,
  ];

  const emittedKeys = new Set<string>();

  const emitGroup = (group: Group | null): void => {
    if (!group || emittedKeys.has(group.key)) return;
    emittedKeys.add(group.key);
    lines.push(...renderGroup(group));
  };

  for (const driver of answers.proteusDrivers) {
    emitGroup(proteusGroup(driver));
  }

  emitGroup(irisGroup(answers.irisDriver));

  if (answers.features.auth) {
    lines.push(
      `  auth: z.object({`,
      `    clientId: z.string(),`,
      `    clientSecret: z.string(),`,
      `    issuer: z.string(),`,
      `  }),`,
    );
  }

  lines.push(`});`, ``);

  return lines.join("\n");
};
