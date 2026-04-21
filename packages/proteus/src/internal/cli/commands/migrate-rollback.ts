import { resolve } from "path";
import { Logger } from "@lindorm/logger";
import { formatRollbackResult } from "../output/format-migration-result.js";
import type { GlobalOptions } from "../with-source.js";
import { withSource } from "../with-source.js";
import { withMigrationManager } from "../with-migration-manager.js";

type RollbackOptions = GlobalOptions & {
  count: string;
  directory?: string;
};

export const migrateRollback = async (options: RollbackOptions): Promise<void> => {
  await withSource(options, async ({ source }) => {
    const directory = resolve(process.cwd(), options.directory ?? "./migrations");
    const count = parseInt(options.count, 10);

    if (isNaN(count) || count < 1) {
      throw new Error("--count must be a positive integer");
    }

    await withMigrationManager(source, directory, async ({ manager }) => {
      const result = await manager.rollback(count);

      if (result.applied.length === 0) {
        Logger.std.log("No migrations to roll back.");
        return;
      }

      const output = formatRollbackResult(result.applied, directory);
      Logger.std.log(output);
    });
  });
};
