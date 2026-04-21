import type { EntityMetadata } from "../../entity/types/metadata.js";
import type { SyncOperation } from "../../drivers/postgres/types/sync-plan.js";
import { getEntityName } from "../../entity/utils/get-entity-name.js";

export type EntityGroup = {
  entityName: string;
  tableName: string;
  operations: Array<SyncOperation>;
  destructiveCount: number;
  isJoinTable: boolean;
  relatedEntities?: [string, string];
};

export type GroupedOperations = {
  groups: Array<EntityGroup>;
  ungrouped: Array<SyncOperation>;
};

export const groupOperationsByEntity = (
  operations: Array<SyncOperation>,
  metadataList: Array<EntityMetadata>,
  namespace?: string,
): GroupedOperations => {
  // Build table → entity name mapping
  const tableToEntity = new Map<string, string>();
  const entityTables = new Set<string>();

  for (const meta of metadataList) {
    const name = getEntityName(meta.target, { namespace });
    const qualifiedName = `${name.namespace ?? "public"}.${name.name}`;
    tableToEntity.set(qualifiedName, meta.target.name);
    entityTables.add(qualifiedName);
  }

  // Group operations by table
  const byTable = new Map<string, Array<SyncOperation>>();
  const ungrouped: Array<SyncOperation> = [];

  for (const op of operations) {
    if (!op.table) {
      ungrouped.push(op);
      continue;
    }

    const qualifiedName = op.schema ? `${op.schema}.${op.table}` : op.table;
    const existing = byTable.get(qualifiedName) ?? [];
    existing.push(op);
    byTable.set(qualifiedName, existing);
  }

  // Build groups
  const groups: Array<EntityGroup> = [];

  for (const [qualifiedName, ops] of byTable) {
    const entityName = tableToEntity.get(qualifiedName);
    const destructiveCount = ops.filter((o) => o.severity === "destructive").length;

    if (entityName) {
      groups.push({
        entityName,
        tableName: qualifiedName,
        operations: ops,
        destructiveCount,
        isJoinTable: false,
      });
    } else {
      // Join table — not directly mapped to an entity
      groups.push({
        entityName: qualifiedName,
        tableName: qualifiedName,
        operations: ops,
        destructiveCount,
        isJoinTable: true,
      });
    }
  }

  return { groups, ungrouped };
};
