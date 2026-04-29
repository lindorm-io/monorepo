import type { SyncOperation } from "../../drivers/postgres/types/sync-plan.js";
import type { EntityGroup } from "./group-operations.js";

export const filterOperationsByEntities = (
  allOperations: Array<SyncOperation>,
  selectedGroups: Array<EntityGroup>,
  ungrouped: Array<SyncOperation>,
): Array<SyncOperation> => {
  const selectedTables = new Set(selectedGroups.map((g) => g.tableName));

  // Include operations for selected tables
  const filtered = allOperations.filter((op) => {
    if (!op.table) return false;
    const qualifiedName = op.schema ? `${op.schema}.${op.table}` : op.table;
    return selectedTables.has(qualifiedName);
  });

  // Include ungrouped (schema/enum creation) if any selected entity uses that schema
  const selectedSchemas = new Set(
    selectedGroups
      .map((g) => {
        const dot = g.tableName.indexOf(".");
        return dot > -1 ? g.tableName.slice(0, dot) : null;
      })
      .filter(Boolean),
  );

  const includedUngrouped = ungrouped.filter((op) => {
    if (!op.schema) return true; // Non-schema-scoped operations always included
    return selectedSchemas.has(op.schema);
  });

  return [...includedUngrouped, ...filtered];
};
