#!/usr/bin/env node

if (typeof Symbol.metadata === "undefined") {
  (Symbol as any).metadata = Symbol.for("Symbol.metadata");
}

import { readFileSync, realpathSync } from "fs";
import { basename, dirname, resolve } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { Command } from "commander";
import pc from "picocolors";
import { initGit } from "./git.js";
import { installDependencies, installDevDependencies } from "./install.js";
import { runPrompts } from "./prompts.js";
import {
  buildDependencyList,
  buildDevDependencyList,
  needsDockerCompose,
  scaffold,
} from "./scaffold.js";
import {
  BASE_DEV_DEPENDENCIES,
  BASE_RUNTIME_DEPENDENCIES,
  IRIS_DRIVER_DEV_PACKAGES,
  PROTEUS_DRIVER_DEV_PACKAGES,
  selectedDrivers,
} from "./types.js";
import type { Answers } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(here, "..", "package.json"), "utf-8")) as {
  version: string;
};

const printNextSteps = (answers: Answers): void => {
  process.stdout.write("\nDone. Next:\n");
  process.stdout.write(`  cd ${basename(answers.projectDir)}\n`);
  process.stdout.write(`  npm run dev\n`);
  if (needsDockerCompose(answers)) {
    // `dev` runs through `composed`, which starts the docker-compose services
    // and stops them on exit — so Docker must be running, but nothing else.
    process.stdout.write(
      `  ${pc.dim("(starts docker-compose services via composed)")}\n`,
    );
  }
  process.stdout.write("\n");
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
  for (const driver of selectedDrivers(answers)) {
    deps.push(...PROTEUS_DRIVER_DEV_PACKAGES[driver]);
  }
  deps.push(...IRIS_DRIVER_DEV_PACKAGES[answers.bus]);
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

  process.stdout.write(`\nInstalling dev dependencies …\n`);
  await installDevDependencies(answers.projectDir, resolveDevDependencies(answers));

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

const invokedAs = process.argv[1]
  ? pathToFileURL(realpathSync(process.argv[1])).href
  : "";

if (import.meta.url === invokedAs) {
  void program.parseAsync(process.argv);
}

export { program };
