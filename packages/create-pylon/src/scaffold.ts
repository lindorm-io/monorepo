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
    engines: { node: ">=20" },
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

  const body = [
    `// TODO (phase 2): assemble schema based on feature flags for ${answers.projectName}`,
    `import { configuration } from "@lindorm/config";`,
    `import { z } from "zod/v4";`,
    ``,
    `export const config = configuration({`,
    `  schema: z.object({}),`,
    `});`,
    ``,
  ].join("\n");

  writeFileSync(target, body, "utf-8");
};

export const writePylonFile = (answers: Answers): void => {
  const target = join(answers.projectDir, "src/pylon/pylon.ts");
  ensureDir(target);

  const body = [
    `// TODO (phase 2): wire setup/teardown, feature options, worker registration`,
    `import { Pylon } from "@lindorm/pylon";`,
    `import { amphora } from "./amphora";`,
    `import { logger } from "../logger";`,
    ``,
    `export const pylon = new Pylon({`,
    `  logger,`,
    `  amphora,`,
    `  // project: ${answers.projectName}`,
    `});`,
    ``,
  ].join("\n");

  writeFileSync(target, body, "utf-8");
};

const needsDockerCompose = (answers: Answers): boolean =>
  ["postgres", "mysql", "mongo", "redis"].includes(answers.proteusDriver) ||
  ["kafka", "nats", "rabbit", "redis"].includes(answers.irisDriver);

export const writeDockerCompose = (answers: Answers): void => {
  if (!needsDockerCompose(answers)) return;

  const target = join(answers.projectDir, "docker-compose.yml");

  const body = [
    `# TODO (phase 2): assemble containers for selected drivers`,
    `# proteusDriver: ${answers.proteusDriver}`,
    `# irisDriver: ${answers.irisDriver}`,
    `services: {}`,
    ``,
  ].join("\n");

  writeFileSync(target, body, "utf-8");
};

export const writeWorkerFiles = (answers: Answers): void => {
  if (answers.workers.length === 0) return;

  for (const key of answers.workers) {
    const target = join(answers.projectDir, "src/workers", `${key}.ts`);
    ensureDir(target);

    const body = [
      `import type { LindormWorkerCallback } from "@lindorm/worker";`,
      ``,
      `export const CALLBACK: LindormWorkerCallback = async (ctx) => {`,
      `  ctx.logger.info("TODO (phase 2): ${key} worker");`,
      `};`,
      ``,
      `export const INTERVAL = "1m";`,
      ``,
    ].join("\n");

    writeFileSync(target, body, "utf-8");
  }
};

export const writeIrisSamples = (answers: Answers): void => {
  if (answers.irisDriver === "none") return;

  const publisher = join(answers.projectDir, "src/iris/publishers/sample-publisher.ts");
  ensureDir(publisher);
  writeFileSync(
    publisher,
    [
      `// TODO (phase 2): sample publisher wiring for driver ${answers.irisDriver}`,
      `export const publishSample = async (): Promise<void> => {`,
      `  // no-op placeholder`,
      `};`,
      ``,
    ].join("\n"),
    "utf-8",
  );

  const subscriber = join(
    answers.projectDir,
    "src/iris/subscribers/sample-subscriber.ts",
  );
  ensureDir(subscriber);
  writeFileSync(
    subscriber,
    [
      `// TODO (phase 2): sample subscriber wiring for driver ${answers.irisDriver}`,
      `export const sampleSubscriber = {`,
      `  topic: "sample",`,
      `};`,
      ``,
    ].join("\n"),
    "utf-8",
  );
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
