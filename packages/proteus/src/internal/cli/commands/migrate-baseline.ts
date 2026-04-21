import { basename, resolve } from "path";
import { Logger } from "@lindorm/logger";
import type { GlobalOptions } from "../with-source.js";
import { withSource } from "../with-source.js";
import { withMigrationManager } from "../with-migration-manager.js";

type BaselineOptions = GlobalOptions & {
  name: string;
  directory?: string;
};

export const migrateBaseline = async (options: BaselineOptions): Promise<void> => {
  await withSource(options, async ({ source }) => {
    const directory = resolve(process.cwd(), options.directory ?? "./migrations");

    await withMigrationManager(source, directory, async ({ manager }) => {
      if (!manager.generateBaseline) {
        throw new Error(
          `"migrate baseline" is not supported for the ${source.driverType} driver`,
        );
      }

      const metadataList = source.getEntityMetadata();

      const result = await manager.generateBaseline(
        metadataList,
        { namespace: source.namespace },
        { name: options.name },
      );

      const filename = basename(result.filepath);

      Logger.std.info(`Generated baseline migration: ${filename}`);
      Logger.std.log(`  Location: ${result.filepath}`);
      Logger.std.log(`  Operations: ${result.operationCount}`);

      if (result.markedAsApplied) {
        Logger.std.info("\nDatabase matches desired schema. Baseline marked as applied.");
      }
    });
  });
};
