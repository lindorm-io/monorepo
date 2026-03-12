import { resolve } from "path";
import { Logger } from "@lindorm/logger";
import { formatStatusTable } from "../output/format-status-table";
import type { GlobalOptions } from "../with-source";
import { withSource } from "../with-source";
import { withMigrationManager } from "../with-migration-manager";

type StatusOptions = GlobalOptions & {
  directory?: string;
};

export const migrateStatus = async (options: StatusOptions): Promise<void> => {
  await withSource(options, async ({ source }) => {
    const directory = resolve(process.cwd(), options.directory ?? "./migrations");

    await withMigrationManager(source, directory, async ({ manager }) => {
      const { resolved, ghosts } = await manager.status();

      const output = formatStatusTable(
        resolved.map((r) => ({ name: r.name, status: r.status })),
        ghosts.map((g) => ({ name: g.name, id: g.id })),
        directory,
      );

      Logger.std.log(output);
    });
  });
};
