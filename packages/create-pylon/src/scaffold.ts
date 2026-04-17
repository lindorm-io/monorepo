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
import { buildConfigFile } from "./build-config-file";
import { buildDockerCompose } from "./build-docker-compose";
import { buildIrisSamples } from "./build-iris-samples";
import { buildPylonFile } from "./build-pylon-file";
import { buildWorkerFile } from "./build-worker-file";
import type { Answers } from "./types";
import {
  IRIS_DRIVER_PACKAGES,
  IRIS_ENV_VARS,
  PROTEUS_DRIVER_PACKAGES,
  PROTEUS_ENV_VARS,
} from "./types";

const TEMPLATE_ROOT = resolve(__dirname, "..", "templates");

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

  if (answers.proteusDriver !== "none") {
    deps.push("@lindorm/proteus", ...PROTEUS_DRIVER_PACKAGES[answers.proteusDriver]);
  }

  if (answers.irisDriver !== "none") {
    deps.push("@lindorm/iris", ...IRIS_DRIVER_PACKAGES[answers.irisDriver]);
  }

  return deps;
};

export const buildDevDependencyList = (_answers: Answers): Array<string> => [];

export const writePackageJson = (answers: Answers): void => {
  const pkg: Record<string, unknown> = {
    name: answers.projectName,
    version: "0.0.0",
    private: true,
    engines: { node: ">=24.13.0" },
    scripts: {
      dev: "tsx watch src/index.ts",
      build: "tsc -p tsconfig.build.json",
      start: "node dist/index.js",
      typecheck: "tsc --noEmit",
      test: "jest",
    },
    dependencies: {},
    devDependencies: {},
  };

  const driverNeedsCompose =
    ["postgres", "mysql", "mongo", "redis"].includes(answers.proteusDriver) ||
    ["kafka", "nats", "rabbit", "redis"].includes(answers.irisDriver);

  if (driverNeedsCompose) {
    const scripts = pkg.scripts as Record<string, string>;
    scripts["docker:up"] = "docker compose up -d";
    scripts["docker:down"] = "docker compose down";
  }

  const target = join(answers.projectDir, "package.json");
  writeFileSync(target, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
};

export const buildEnvLines = (answers: Answers): Array<string> => {
  const lines: Array<string> = ["NODE_ENV=development"];

  for (const entry of PROTEUS_ENV_VARS[answers.proteusDriver]) {
    lines.push(`${entry.key}=${entry.value}`);
  }

  for (const entry of IRIS_ENV_VARS[answers.irisDriver]) {
    lines.push(`${entry.key}=${entry.value}`);
  }

  return lines;
};

export const writeEnvFile = (answers: Answers): void => {
  const lines = buildEnvLines(answers);
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
  ["postgres", "mysql", "mongo", "redis"].includes(answers.proteusDriver) ||
  ["kafka", "nats", "rabbit", "redis"].includes(answers.irisDriver);

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

export const scaffold = async (answers: Answers): Promise<void> => {
  copyTemplates(answers);
  writePackageJson(answers);
  writeEnvFile(answers);
  writeConfigFile(answers);
  writePylonFile(answers);
  writeDockerCompose(answers);
  writeWorkerFiles(answers);
  writeIrisSamples(answers);
};
