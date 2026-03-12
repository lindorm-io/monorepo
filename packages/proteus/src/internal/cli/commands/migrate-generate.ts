import { resolve } from "path";
import { Logger } from "@lindorm/logger";
import type { PoolClient } from "pg";
import type { GlobalOptions } from "../with-source";
import { withSource } from "../with-source";
import { withMigrationManager, wrapPoolClient } from "../with-migration-manager";

type GenerateOptions = GlobalOptions & {
  name: string;
  directory?: string;
  dryRun?: boolean;
  interactive?: boolean;
};

export const migrateGenerate = async (options: GenerateOptions): Promise<void> => {
  await withSource(options, async ({ source }) => {
    const directory = resolve(process.cwd(), options.directory ?? "./migrations");
    const metadataList = source.getEntityMetadata();

    if (options.interactive) {
      if (source.driverType !== "postgres") {
        throw new Error(
          `Interactive generate is only available for the postgres driver, got "${source.driverType}"`,
        );
      }

      // Interactive mode uses postgres-specific pipeline directly (A18 scope).
      // source.client() returns a pg PoolClient when driverType is "postgres".
      const poolClient = await source.client<PoolClient>();
      let released = false;

      const release = () => {
        if (!released) {
          released = true;
          poolClient.release();
        }
      };

      const client = wrapPoolClient(poolClient);

      try {
        const { runInteractiveGenerate } =
          await import("../interactive/run-interactive-generate");
        await runInteractiveGenerate({
          client: client as any,
          metadataList,
          source,
          directory,
        });
      } finally {
        release();
      }
      return;
    }

    // Non-interactive: delegate to the migration manager
    await withMigrationManager(source, directory, async ({ manager }) => {
      if (!manager.generateMigration) {
        throw new Error(
          `"migrate generate" is not supported for the ${source.driverType} driver`,
        );
      }

      const result = await manager.generateMigration(
        metadataList,
        { namespace: source.namespace },
        { name: options.name, writeFile: !options.dryRun },
      );

      if (result.isEmpty) {
        Logger.std.log("No schema changes detected — no migration generated.");
        return;
      }

      if (options.dryRun) {
        Logger.std.log("Dry run — migration not written to disk.");
        return;
      }

      if (result.filepath) {
        const filename = result.filepath.split("/").pop() ?? result.filepath;
        Logger.std.info(`Generated migration: ${filename}`);
        Logger.std.log(`  Location: ${result.filepath}`);
        Logger.std.log(`  Operations: ${result.operationCount}`);
      }
    });
  });
};
