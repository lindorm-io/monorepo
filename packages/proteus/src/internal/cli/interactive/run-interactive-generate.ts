import { Logger } from "@lindorm/logger";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import type { ProteusSource } from "../../../classes/ProteusSource";
import type { PostgresQueryClient } from "#internal/drivers/postgres/types/postgres-query-client";
import { projectDesiredSchema } from "#internal/drivers/postgres/utils/sync/project-desired-schema";
import { introspectSchema } from "#internal/drivers/postgres/utils/sync/introspect-schema";
import { diffSchema } from "#internal/drivers/postgres/utils/sync/diff-schema";
import { serializeMigration } from "#internal/drivers/postgres/utils/migration/serialize-migration";
import { writeMigrationFile } from "#internal/drivers/postgres/utils/migration/write-migration-file";
import { groupOperationsByEntity } from "./group-operations";
import { filterOperationsByEntities } from "./filter-operations";
import { suggestMigrationName } from "./suggest-name";
import { previewOperations } from "./preview-operations";

type InteractiveGenerateOptions = {
  client: PostgresQueryClient;
  metadataList: Array<EntityMetadata>;
  source: ProteusSource;
  directory: string;
};

export const runInteractiveGenerate = async (
  options: InteractiveGenerateOptions,
): Promise<void> => {
  const { client, metadataList, source, directory } = options;

  // 1. Run full diff pipeline
  const desired = projectDesiredSchema(metadataList, { namespace: source.namespace });
  const managedTables = desired.tables.map((t) => ({ schema: t.schema, name: t.name }));
  const snapshot = await introspectSchema(client, managedTables);
  const plan = diffSchema(snapshot, desired);

  const executableOps = plan.operations.filter((op) => op.type !== "warn_only");

  if (executableOps.length === 0) {
    Logger.std.log("No schema changes detected — no migration generated.");
    return;
  }

  // 2. Group by entity
  const { groups, ungrouped } = groupOperationsByEntity(
    executableOps,
    metadataList,
    source.namespace ?? undefined,
  );

  if (groups.length === 0 && ungrouped.length === 0) {
    Logger.std.log("No schema changes detected — no migration generated.");
    return;
  }

  // 3. Entity selection (if multiple entities have changes)
  let selectedGroups = groups;

  if (groups.length > 1) {
    const { checkbox } = await import("@inquirer/prompts");

    const choices = groups.map((g) => {
      const opCount = g.operations.length;
      const severity =
        g.destructiveCount > 0 ? `(${g.destructiveCount} destructive)` : "(safe)";
      const label = g.isJoinTable ? `${g.entityName} (join table)` : g.entityName;

      return {
        name: `${label.padEnd(20)} ${opCount} ops ${severity}`,
        value: g,
        checked: true,
      };
    });

    Logger.std.log(`\nChanges detected for ${groups.length} entities:\n`);

    selectedGroups = await checkbox({
      message: "Select entities to include in migration",
      choices,
    });

    if (selectedGroups.length === 0) {
      Logger.std.log("No entities selected — aborting.");
      return;
    }
  }

  // 4. Filter operations
  const filteredOps =
    groups.length === 0
      ? ungrouped
      : filterOperationsByEntities(executableOps, selectedGroups, ungrouped);

  // 5. Preview
  Logger.std.log(previewOperations(filteredOps));

  // Print warn_only operations
  const warnOps = plan.operations.filter((op) => op.type === "warn_only");
  for (const op of warnOps) {
    Logger.std.warn(`Warning: ${op.description}`);
  }

  // 6. Name prompt
  const { input } = await import("@inquirer/prompts");
  const entityNames = selectedGroups
    .filter((g) => !g.isJoinTable)
    .map((g) => g.entityName);
  const suggested = suggestMigrationName(entityNames, filteredOps);

  const migrationName = await input({
    message: "Migration name:",
    default: suggested,
  });

  // 7. Confirm
  const { confirm } = await import("@inquirer/prompts");
  const confirmed = await confirm({
    message: `Write migration to ${directory}?`,
    default: true,
  });

  if (!confirmed) {
    Logger.std.log("Aborted.");
    return;
  }

  // 8. Serialize + write
  const filteredPlan = {
    ...plan,
    operations: filteredOps,
    summary: {
      safe: filteredOps.filter((o) => o.severity === "safe").length,
      warning: filteredOps.filter((o) => o.severity === "warning").length,
      destructive: filteredOps.filter((o) => o.severity === "destructive").length,
      total: filteredOps.length,
    },
  };

  const migration = serializeMigration(filteredPlan, snapshot, { name: migrationName });
  const filepath = await writeMigrationFile(
    directory,
    migration.filename,
    migration.content,
  );

  Logger.std.info(`Generated migration: ${migration.filename}`);
  Logger.std.log(`  Location: ${filepath}`);
  Logger.std.log(`  Operations: ${filteredOps.length}`);
};
