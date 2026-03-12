import type { ComposedOptions } from "../../types";
import { composeDown } from "./compose-down";
import { composeUp } from "./compose-up";
import { resolveComposeFile } from "./resolve-compose-file";
import { spawnCommand } from "./spawn-command";

export const composed = async (options: ComposedOptions): Promise<number> => {
  const file = resolveComposeFile(options.file);

  try {
    await composeUp({ ...options, file });
  } catch (err) {
    console.error(
      `Failed to start services: ${err instanceof Error ? err.message : String(err)}`,
    );
    if (options.teardown) await composeDown(file, options.verbose);
    return 1;
  }

  let exitCode: number;

  try {
    exitCode = await spawnCommand(options.command, options.commandArgs);
  } catch {
    exitCode = 127;
  } finally {
    if (options.teardown) {
      await composeDown(file, options.verbose);
    }
  }

  return exitCode;
};
