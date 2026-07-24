import type { ComposedOptions } from "../../types/index.js";
import { composeDown } from "./compose-down.js";
import { composeUp } from "./compose-up.js";
import { inspectServices } from "./inspect-services.js";
import { resolveComposeFile } from "./resolve-compose-file.js";
import { spawnCommand } from "./spawn-command.js";

const elapsedSeconds = (startMs: number): string =>
  ((Date.now() - startMs) / 1000).toFixed(1);

export const composed = async (options: ComposedOptions): Promise<number> => {
  const file = resolveComposeFile(options.file);
  const quiet = !options.verbose;

  // `--reuse`: attach to an already-running stack rather than start a fresh one.
  // `startedByUs` gates teardown — a reused stack is left exactly as found.
  let startedByUs = true;

  if (options.reuse) {
    const inspection = await inspectServices({ file, project: options.project });

    if (inspection.status === "all") {
      startedByUs = false;
      if (quiet) {
        process.stdout.write(
          `Reusing already-running services (ports ${inspection.required.join(", ")})\n`,
        );
      }
    } else if (inspection.status === "partial") {
      const conflicts = inspection.boundRequired
        .map((port) => `${port} (held by ${inspection.bound.get(port)})`)
        .join(", ");
      process.stderr.write(
        `Cannot start services: host port(s) already in use by another stack: ${conflicts}. ` +
          `Stop the conflicting container(s) or free the port(s); --reuse only attaches when ALL required ports are already served.\n`,
      );
      return 1;
    }
  }

  if (startedByUs) {
    const upStart = Date.now();
    if (quiet) process.stdout.write("Starting services...\n");

    try {
      await composeUp({ ...options, file });
    } catch (err) {
      process.stderr.write(
        `Failed to start services: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      if (options.teardown)
        await composeDown(file, options.verbose, options.keepVolumes, options.project);
      return 1;
    }

    if (quiet) process.stdout.write(`Services ready (${elapsedSeconds(upStart)}s)\n`);
  }

  let exitCode: number;

  try {
    exitCode = await spawnCommand(options.command, options.commandArgs);
  } catch {
    exitCode = 127;
  } finally {
    // Reuse implies no teardown: only tear down a stack WE started.
    if (startedByUs && options.teardown) {
      if (quiet) process.stdout.write("Tearing down services...\n");
      const downStart = Date.now();
      await composeDown(file, options.verbose, options.keepVolumes, options.project);
      if (quiet) {
        process.stdout.write(`Teardown complete (${elapsedSeconds(downStart)}s)\n`);
      }
    }
  }

  return exitCode;
};
