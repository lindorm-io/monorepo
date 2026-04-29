#!/usr/bin/env node

if (typeof Symbol.metadata === "undefined") {
  (Symbol as any).metadata = Symbol.for("Symbol.metadata");
}

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { Command } from "commander";
import {
  runIrisGenerateSampleMessage,
  runIrisInit,
  runProteusGenerateSampleEntity,
  runProteusInit,
} from "./drivers.js";
import { initGit } from "./git.js";
import { installDependencies, installDevDependencies } from "./install.js";
import { runPrompts } from "./prompts.js";
import { buildDependencyList, buildDevDependencyList, scaffold } from "./scaffold.js";
import {
  BASE_DEV_DEPENDENCIES,
  BASE_RUNTIME_DEPENDENCIES,
  IRIS_DRIVER_DEV_PACKAGES,
  PROTEUS_DRIVER_DEV_PACKAGES,
} from "./types.js";
import type { Answers } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(here, "..", "package.json"), "utf-8")) as {
  version: string;
};

const printNextSteps = (answers: Answers): void => {
  process.stdout.write("\nDone. Next:\n");
  process.stdout.write(`  cd ${answers.projectName}\n`);
  process.stdout.write(`  npm run dev\n\n`);
};

const registerShutdownHandlers = (getProjectDir: () => string | null): void => {
  const handler = (signal: string): void => {
    const dir = getProjectDir();
    if (dir) {
      process.stderr.write(
        `\n${signal} received — cancelled. Partial files preserved at ${dir}\n`,
      );
    } else {
      process.stderr.write(`\n${signal} received — cancelled.\n`);
    }
    process.exit(130);
  };

  process.on("SIGINT", () => handler("SIGINT"));
  process.on("SIGTERM", () => handler("SIGTERM"));
};

const resolveDevDependencies = (answers: Answers): Array<string> => {
  const deps: Array<string> = [
    ...BASE_DEV_DEPENDENCIES,
    ...buildDevDependencyList(answers),
  ];
  for (const driver of answers.proteusDrivers) {
    deps.push(...PROTEUS_DRIVER_DEV_PACKAGES[driver]);
  }
  deps.push(...IRIS_DRIVER_DEV_PACKAGES[answers.irisDriver]);
  return Array.from(new Set(deps));
};

const resolveRuntimeDependencies = (answers: Answers): Array<string> => [
  ...BASE_RUNTIME_DEPENDENCIES,
  ...buildDependencyList(answers),
];

export const run = async (positionalName?: string): Promise<void> => {
  let currentProjectDir: string | null = null;
  registerShutdownHandlers(() => currentProjectDir);

  const answers = await runPrompts({ positionalName });
  currentProjectDir = answers.projectDir;

  process.stdout.write(`\nCreating ${answers.projectDir} …\n`);
  await scaffold(answers);

  process.stdout.write(`\nInstalling dependencies …\n`);
  await installDependencies(answers.projectDir, resolveRuntimeDependencies(answers));
  await installDevDependencies(answers.projectDir, resolveDevDependencies(answers));

  if (answers.proteusDrivers.length > 0) {
    process.stdout.write(`\nGenerating proteus scaffolding …\n`);
    await runProteusInit(answers.projectDir, answers);
    const firstDbDriver =
      answers.proteusDrivers.length > 1 ? answers.proteusDrivers[0] : undefined;
    await runProteusGenerateSampleEntity(answers.projectDir, firstDbDriver);
  }

  if (answers.irisDriver !== "none") {
    process.stdout.write(`\nGenerating iris scaffolding …\n`);
    await runIrisInit(answers.projectDir, answers.irisDriver);
    await runIrisGenerateSampleMessage(answers.projectDir);
  }

  process.stdout.write(`\nInitialising git …\n`);
  await initGit(answers.projectDir);

  printNextSteps(answers);
};

const program = new Command();

program
  .name("create-pylon")
  .description("Scaffold a new Pylon application")
  .version(pkg.version)
  .argument("[name]", "project name")
  .action(async (name?: string) => {
    try {
      await run(name);
    } catch (error) {
      process.stderr.write(
        `\nerror: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exit(1);
    }
  });

if (import.meta.url === `file://${process.argv[1]}`) {
  void program.parseAsync(process.argv);
}

export { program };
