import type { ComposedOptions } from "../../types/index.js";
import { composeDown } from "./compose-down.js";
import { composeUp } from "./compose-up.js";
import { resolveComposeFile } from "./resolve-compose-file.js";
import { spawnCommand } from "./spawn-command.js";

const elapsedSeconds = (startMs: number): string =>
  ((Date.now() - startMs) / 1000).toFixed(1);

export const composed = async (options: ComposedOptions): Promise<number> => {
  const file = resolveComposeFile(options.file);
  const quiet = !options.verbose;

  const upStart = Date.now();
  if (quiet) process.stdout.write("Starting services...\n");

  try {
    await composeUp({ ...options, file });
  } catch (err) {
    process.stderr.write(
      `Failed to start services: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    if (options.teardown) await composeDown(file, options.verbose);
    return 1;
  }

  if (quiet) process.stdout.write(`Services ready (${elapsedSeconds(upStart)}s)\n`);

  let exitCode: number;

  try {
    exitCode = await spawnCommand(options.command, options.commandArgs);
  } catch {
    exitCode = 127;
  } finally {
    if (options.teardown) {
      if (quiet) process.stdout.write("Tearing down services...\n");
      const downStart = Date.now();
      await composeDown(file, options.verbose);
      if (quiet) {
        process.stdout.write(`Teardown complete (${elapsedSeconds(downStart)}s)\n`);
      }
    }
  }

  return exitCode;
};
