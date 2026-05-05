import { KryptosKit } from "@lindorm/kryptos";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "fs";
import { dirname, join, resolve } from "path";
import { buildAttachSourcesFile } from "./build-attach-sources-file.js";
import { buildConfigFile } from "./build-config-file.js";
import { buildConfigDevelopmentYaml, buildConfigYaml } from "./build-config-yaml.js";
import { buildContextFile } from "./build-context-file.js";
import { buildDockerCompose } from "./build-docker-compose.js";
import { buildIrisSamples } from "./build-iris-samples.js";
import { buildPylonFile } from "./build-pylon-file.js";
import { buildWorkerFile } from "./build-worker-file.js";
import { runProteusInit } from "./drivers.js";
import type { Answers, IrisDriver, ProteusDriver } from "./types.js";
import { IRIS_DRIVER_PACKAGES, PROTEUS_DRIVER_PACKAGES } from "./types.js";

// Far-future expiry — the KEK protects every @Encrypted field in the DB;
// rotating it is a re-encryption migration, not a routine rotation, so a
// practical "no expiry" value avoids silently bricking encrypted data.
const KEK_EXPIRES_AT = new Date("2299-12-31T23:59:59.000Z");

export const generateKekEnvString = (): string =>
  KryptosKit.generate
    .auto({
      algorithm: "dir",
      expiresAt: KEK_EXPIRES_AT,
      hidden: true,
      issuer: "urn:lindorm:pylon:kek",
      purpose: "pylon:kek",
    })
    .toEnvString();

const TEMPLATE_ROOT = resolve(import.meta.dirname, "..", "templates");

const renameDotfiles = (dir: string): void => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      renameDotfiles(fullPath);
      continue;
    }
    if (entry.startsWith("_") && !entry.slice(1).includes(".")) {
      renameSync(fullPath, join(dir, "." + entry.slice(1)));
    }
  }
};

const overlayTemplate = (template: string, projectDir: string): void => {
  const source = join(TEMPLATE_ROOT, template);
  if (!existsSync(source)) return;
  cpSync(source, projectDir, { recursive: true });
};

export const copyTemplates = (answers: Answers): void => {
  mkdirSync(answers.projectDir, { recursive: true });

  overlayTemplate("base", answers.projectDir);

  if (answers.features.http) overlayTemplate("http", answers.projectDir);
  if (answers.features.socket) overlayTemplate("socket", answers.projectDir);
  if (answers.workers.length > 0) overlayTemplate("workers", answers.projectDir);
  if (answers.features.webhooks) overlayTemplate("webhooks", answers.projectDir);

  renameDotfiles(answers.projectDir);
};

export const buildDependencyList = (answers: Answers): Array<string> => {
  const deps: Array<string> = [];

  if (answers.proteusDrivers.length > 0) {
    deps.push("@lindorm/proteus");
    for (const driver of answers.proteusDrivers) {
      deps.push(...PROTEUS_DRIVER_PACKAGES[driver]);
    }
  }

  if (answers.irisDriver !== "none") {
    deps.push("@lindorm/iris", ...IRIS_DRIVER_PACKAGES[answers.irisDriver]);
  }

  return Array.from(new Set(deps));
};

export const buildDevDependencyList = (_answers: Answers): Array<string> => [];

export const writePackageJson = (answers: Answers): void => {
  const pkg: Record<string, unknown> = {
    name: answers.projectName,
    version: "0.0.0",
    private: true,
    type: "module",
    engines: { node: ">=24.13.0" },
    scripts: {
      dev: "tsx watch src/index.ts",
      build: "tsc -p tsconfig.build.json",
      start: "node dist/index.js",
      typecheck: "tsc --noEmit",
      test: "vitest run",
    },
    dependencies: {},
    devDependencies: {},
  };

  const proteusNeedsCompose = answers.proteusDrivers.some((d) =>
    ["postgres", "mysql", "mongo", "redis"].includes(d),
  );
  const irisNeedsCompose = ["kafka", "nats", "rabbit", "redis"].includes(
    answers.irisDriver,
  );
  const driverNeedsCompose = proteusNeedsCompose || irisNeedsCompose;

  if (driverNeedsCompose) {
    const scripts = pkg.scripts as Record<string, string>;
    scripts["docker:up"] = "docker compose up -d";
    scripts["docker:down"] = "docker compose down";
  }

  const target = join(answers.projectDir, "package.json");
  writeFileSync(target, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
};

/**
 * Lines for the gitignored `.env` — only the values that genuinely have
 * to live in a per-developer secret file. Driver URLs and similar
 * dev-friendly defaults belong in `config/development.yml` instead, so
 * they're committed and a teammate can clone-and-run.
 */
export const buildEnvLines = (
  answers: Answers,
  kek: string = generateKekEnvString(),
): Array<string> => {
  const lines: Array<string> = ["NODE_ENV=development", `PYLON__KEK=${kek}`];
  if (answers.features.auth) {
    lines.push(`AUTH__CLIENT_SECRET=`);
  }
  return lines;
};

type ExampleEntry = {
  key: string;
  value: string;
  // Commented entries serve as a "you can override this" reference; the
  // value already lives in YAML, so users only uncomment if they need a
  // per-developer override.
  commented: boolean;
};

const proteusExampleEntries = (driver: ProteusDriver): Array<ExampleEntry> => {
  switch (driver) {
    case "postgres":
      return [
        {
          key: "POSTGRES__URL",
          value: "postgresql://postgres:postgres@localhost:5432/app",
          commented: true,
        },
      ];
    case "mysql":
      return [
        {
          key: "MYSQL__URL",
          value: "mysql://root:root@localhost:3306/app",
          commented: true,
        },
      ];
    case "mongo":
      return [
        { key: "MONGO__URL", value: "mongodb://localhost:27017/app", commented: true },
      ];
    case "redis":
      return [{ key: "REDIS__URL", value: "redis://localhost:6379", commented: true }];
    case "sqlite":
      return [{ key: "SQLITE__PATH", value: "./data/app.db", commented: true }];
    case "memory":
      return [];
  }
};

const irisExampleEntries = (driver: IrisDriver): Array<ExampleEntry> => {
  switch (driver) {
    case "kafka":
      return [{ key: "KAFKA__BROKERS", value: `["localhost:9092"]`, commented: true }];
    case "nats":
      return [{ key: "NATS__SERVERS", value: "nats://localhost:4222", commented: true }];
    case "rabbit":
      return [
        {
          key: "RABBIT__URL",
          value: "amqp://guest:guest@localhost:5672",
          commented: true,
        },
      ];
    case "redis":
      return [{ key: "REDIS__URL", value: "redis://localhost:6379", commented: true }];
    case "none":
      return [];
  }
};

const formatExampleEntry = (entry: ExampleEntry): string =>
  entry.commented ? `# ${entry.key}=${entry.value}` : `${entry.key}=${entry.value}`;

/**
 * Lines for the committed `.env.example` — a copy-paste reference of
 * every env var the service's schema responds to.
 *
 * Required secrets are uncommented (so `cp .env.example .env` produces
 * a file the user knows to fill in). Everything else is commented and
 * shows the same default that already lives in `config/{NODE_ENV}.yml`,
 * so devs who only want defaults don't have to copy anything.
 */
export const buildEnvExampleLines = (answers: Answers): Array<string> => {
  const lines: Array<string> = [
    `# Reference for every env var the service's schema responds to.`,
    `# Copy to .env (gitignored) and fill in the secrets, or just keep using`,
    `# the defaults from config/default.yml + config/development.yml.`,
    `#`,
    `# Naming convention: each schema-path segment in CONSTANT_CASE, joined by`,
    `# __ (double underscore). e.g. database.maxRetries -> DATABASE__MAX_RETRIES.`,
    ``,
    `# --- Required secrets ---`,
    `PYLON__KEK=kryptos:GENERATE_VIA_create-pylon_OR_KryptosKit`,
  ];

  if (answers.features.auth) {
    lines.push(
      ``,
      `# --- OIDC client (auth) ---`,
      `AUTH__CLIENT_SECRET=`,
      `# AUTH__CLIENT_ID=`,
      `# AUTH__ISSUER=https://auth.example.com`,
    );
  }

  const overrideEntries: Array<ExampleEntry> = [
    { key: "NODE_ENV", value: "development", commented: true },
    { key: "SERVER__PORT", value: "3000", commented: true },
    { key: "LOGGER__LEVEL", value: "info", commented: true },
  ];

  const seenKeys = new Set<string>();
  const pushEntries = (entries: ReadonlyArray<ExampleEntry>) => {
    for (const e of entries) {
      if (seenKeys.has(e.key)) continue;
      seenKeys.add(e.key);
      overrideEntries.push(e);
    }
  };

  for (const driver of answers.proteusDrivers) {
    pushEntries(proteusExampleEntries(driver));
  }
  pushEntries(irisExampleEntries(answers.irisDriver));

  if (overrideEntries.length > 0) {
    lines.push(
      ``,
      `# --- Optional overrides (defaults already in config/*.yml) ---`,
      ...overrideEntries.map(formatExampleEntry),
    );
  }

  return lines;
};

export const writeEnvFile = (
  answers: Answers,
  kek: string = generateKekEnvString(),
): void => {
  const lines = buildEnvLines(answers, kek);
  const target = join(answers.projectDir, ".env");
  writeFileSync(target, lines.join("\n") + "\n", "utf-8");
};

export const writeEnvExampleFile = (answers: Answers): void => {
  const lines = buildEnvExampleLines(answers);
  const target = join(answers.projectDir, ".env.example");
  writeFileSync(target, lines.join("\n") + "\n", "utf-8");
};

const ensureDir = (filePath: string): void => {
  mkdirSync(dirname(filePath), { recursive: true });
};

export const writeConfigFile = (answers: Answers): void => {
  const target = join(answers.projectDir, "src/pylon/config.ts");
  ensureDir(target);
  writeFileSync(target, buildConfigFile(answers), "utf-8");
};

export const writeConfigYaml = (answers: Answers): void => {
  const target = join(answers.projectDir, "config/default.yml");
  ensureDir(target);
  writeFileSync(target, buildConfigYaml(answers), "utf-8");
};

export const writeConfigDevelopmentYaml = (answers: Answers): void => {
  const target = join(answers.projectDir, "config/development.yml");
  ensureDir(target);
  writeFileSync(target, buildConfigDevelopmentYaml(answers), "utf-8");
};

export const writeContextFile = (answers: Answers): void => {
  const target = join(answers.projectDir, "src/types/context.ts");
  ensureDir(target);
  writeFileSync(target, buildContextFile(answers), "utf-8");
};

export const writeAttachSourcesFile = (answers: Answers): void => {
  const content = buildAttachSourcesFile(answers);
  if (!content) return;

  const target = join(answers.projectDir, "src/middleware/attach-sources.ts");
  ensureDir(target);
  writeFileSync(target, content, "utf-8");
};

export const writePylonFile = (answers: Answers): void => {
  const target = join(answers.projectDir, "src/pylon/pylon.ts");
  ensureDir(target);
  writeFileSync(target, buildPylonFile(answers), "utf-8");
};

export const needsDockerCompose = (answers: Answers): boolean =>
  answers.proteusDrivers.some((d) =>
    ["postgres", "mysql", "mongo", "redis"].includes(d),
  ) || ["kafka", "nats", "rabbit", "redis"].includes(answers.irisDriver);

export const writeDockerCompose = (answers: Answers): void => {
  if (!needsDockerCompose(answers)) return;

  const body = buildDockerCompose(answers);
  if (!body) return;

  const target = join(answers.projectDir, "docker-compose.yml");
  writeFileSync(target, body, "utf-8");
};

export const writeWorkerFiles = (answers: Answers): void => {
  if (answers.workers.length === 0) return;

  for (const key of answers.workers) {
    const target = join(answers.projectDir, "src/workers", `${key}.ts`);
    ensureDir(target);
    writeFileSync(target, buildWorkerFile(key, answers), "utf-8");
  }
};

export const writeIrisSamples = (answers: Answers): void => {
  if (answers.irisDriver === "none") return;

  const files = buildIrisSamples();

  const publisher = join(answers.projectDir, "src/iris/publishers/sample-publisher.ts");
  ensureDir(publisher);
  writeFileSync(publisher, files.publisher, "utf-8");

  const subscriber = join(
    answers.projectDir,
    "src/iris/subscribers/sample-subscriber.ts",
  );
  ensureDir(subscriber);
  writeFileSync(subscriber, files.subscriber, "utf-8");
};

export const scaffold = async (
  answers: Answers,
  kek: string = generateKekEnvString(),
): Promise<void> => {
  copyTemplates(answers);
  writePackageJson(answers);
  writeEnvFile(answers, kek);
  writeEnvExampleFile(answers);
  writeConfigFile(answers);
  writeConfigYaml(answers);
  writeConfigDevelopmentYaml(answers);
  writeContextFile(answers);
  writePylonFile(answers);
  writeDockerCompose(answers);
  writeWorkerFiles(answers);
  writeIrisSamples(answers);
  writeAttachSourcesFile(answers);
  await runProteusInit(answers.projectDir, answers);
};
