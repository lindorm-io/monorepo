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
import { buildConfigFile } from "./build-config-file.js";
import { buildDockerCompose } from "./build-docker-compose.js";
import { buildIrisSamples } from "./build-iris-samples.js";
import { buildPylonFile } from "./build-pylon-file.js";
import { buildWorkerFile } from "./build-worker-file.js";
import { runProteusInit } from "./drivers.js";
import type { Answers } from "./types.js";
import {
  AUTH_ENV_VARS,
  IRIS_DRIVER_PACKAGES,
  IRIS_ENV_VARS,
  PROTEUS_DRIVER_PACKAGES,
  PROTEUS_ENV_VARS,
} from "./types.js";

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

export const buildEnvLines = (
  answers: Answers,
  kek: string = generateKekEnvString(),
): Array<string> => {
  const lines: Array<string> = ["NODE_ENV=development", `PYLON_KEK=${kek}`];
  const seenEnvKeys = new Set<string>();

  const pushEnvEntries = (entries: ReadonlyArray<{ key: string; value: string }>) => {
    for (const entry of entries) {
      if (seenEnvKeys.has(entry.key)) continue;
      seenEnvKeys.add(entry.key);
      lines.push(`${entry.key}=${entry.value}`);
    }
  };

  for (const driver of answers.proteusDrivers) {
    pushEnvEntries(PROTEUS_ENV_VARS[driver]);
  }

  pushEnvEntries(IRIS_ENV_VARS[answers.irisDriver]);

  if (answers.features.auth) {
    for (const entry of AUTH_ENV_VARS) {
      lines.push(`${entry.key}=${entry.value}`);
    }
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

const ensureDir = (filePath: string): void => {
  mkdirSync(dirname(filePath), { recursive: true });
};

export const writeConfigFile = (answers: Answers): void => {
  const target = join(answers.projectDir, "src/pylon/config.ts");
  ensureDir(target);
  writeFileSync(target, buildConfigFile(answers), "utf-8");
};

export const writePylonFile = (answers: Answers): void => {
  const target = join(answers.projectDir, "src/pylon/pylon.ts");
  ensureDir(target);
  writeFileSync(target, buildPylonFile(answers), "utf-8");
};

const needsDockerCompose = (answers: Answers): boolean =>
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
    writeFileSync(target, buildWorkerFile(key), "utf-8");
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
  writeConfigFile(answers);
  writePylonFile(answers);
  writeDockerCompose(answers);
  writeWorkerFiles(answers);
  writeIrisSamples(answers);
  await runProteusInit(answers.projectDir, answers);
};
