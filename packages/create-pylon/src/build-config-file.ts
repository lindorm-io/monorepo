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
      return { key: "kafka", lines: [`    brokers: z.array(z.string()),`] };
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
    `// Each leaf is overridable from the environment. The env-var name is`,
    `// the schema path with each segment converted to CONSTANT_CASE and`,
    `// joined with "__":`,
    `//`,
    `//   pylon.kek           → PYLON__KEK`,
    `//   server.port         → SERVER__PORT`,
    `//   nodeEnv             → NODE_ENV (single segment, no separator)`,
    `//`,
    `// See config/default.yml for non-secret defaults you can edit.`,
    `export const config = configuration({`,
    `  nodeEnv: z`,
    `    .enum(["production", "staging", "development", "test", "unknown"])`,
    `    .default("development"),`,
    `  pylon: z.object({ kek: z.string() }),`,
    `  server: z.object({ port: z.number() }),`,
    `  logger: z`,
    `    .object({`,
    `      level: z`,
    `        .enum(["error", "warn", "info", "verbose", "debug", "silly"])`,
    `        .default("info"),`,
    `    })`,
    `    .default({}),`,
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

  // Close the schema object and pass `scope: import.meta.url` so
  // `npm.package.{name, version}` is resolved from this project's
  // own package.json, not from a cwd walk — works identically under
  // `npm start`, bare `node dist/index.js`, and Docker CMDs.
  lines.push(`}, { scope: import.meta.url });`, ``);

  return lines.join("\n");
};
