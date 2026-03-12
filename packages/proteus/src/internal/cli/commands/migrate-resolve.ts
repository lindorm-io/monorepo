import { resolve } from "path";
import { Logger } from "@lindorm/logger";
import type { GlobalOptions } from "../with-source";
import { withSource } from "../with-source";
import { withMigrationManager } from "../with-migration-manager";

type ResolveOptions = GlobalOptions & {
  applied?: string;
  rolledBack?: string;
  directory?: string;
};

export const migrateResolve = async (options: ResolveOptions): Promise<void> => {
  await withSource(options, async ({ source }) => {
    if (!options.applied && !options.rolledBack) {
      throw new Error("Exactly one of --applied or --rolled-back is required");
    }
    if (options.applied && options.rolledBack) {
      throw new Error("Cannot use both --applied and --rolled-back");
    }

    const directory = resolve(process.cwd(), options.directory ?? "./migrations");

    await withMigrationManager(source, directory, async ({ manager }) => {
      if (options.applied) {
        await manager.resolveApplied(options.applied, directory);
        Logger.std.info(`Marked migration as applied: ${options.applied}`);
        return;
      }

      if (options.rolledBack) {
        await manager.resolveRolledBack(options.rolledBack);
        Logger.std.info(`Marked migration as rolled back: ${options.rolledBack}`);
      }
    });
  });
};
