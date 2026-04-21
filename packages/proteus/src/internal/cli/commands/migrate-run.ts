import { resolve } from "path";
import { Logger } from "@lindorm/logger";
import { formatApplyResult } from "../output/format-migration-result.js";
import type { GlobalOptions } from "../with-source.js";
import { withSource } from "../with-source.js";
import { withMigrationManager } from "../with-migration-manager.js";

type RunOptions = GlobalOptions & {
  directory?: string;
};

export const migrateRun = async (options: RunOptions): Promise<void> => {
  await withSource(options, async ({ source }) => {
    const directory = resolve(process.cwd(), options.directory ?? "./migrations");

    await withMigrationManager(source, directory, async ({ manager }) => {
      const result = await manager.apply();

      if (result.applied.length === 0) {
        Logger.std.log("No pending migrations to apply.");
        return;
      }

      const output = formatApplyResult(result.applied, result.skipped, directory);
      Logger.std.log(output);
    });
  });
};
