import type { IEntity } from "../../../../interfaces/index.js";
import type { MetaRelation } from "../../../entity/types/metadata.js";
import type { JoinTableOps } from "../../../types/join-table-ops.js";
import type { MemoryStore, MemoryTable } from "../types/memory-store.js";
import { getJoinName } from "../../../entity/utils/get-join-name.js";

const resolveJoinTable = (
  store: MemoryStore,
  joinTableName: string,
  namespace: string | null,
): MemoryTable => {
  const joinName = getJoinName(joinTableName, { namespace });
  const key = joinName.namespace
    ? `${joinName.namespace}.${joinName.name}`
    : joinName.name;

  let table = store.joinTables.get(key);
  if (!table) {
    table = new Map();
    store.joinTables.set(key, table);
  }
  return table;
};

const buildJoinRowKey = (
  ownerValues: Array<unknown>,
  targetValues: Array<unknown>,
): string => JSON.stringify([...ownerValues, ...targetValues]);

export const createMemoryJoinTableOps = (getStore: () => MemoryStore): JoinTableOps => ({
  sync: async (
    entity: IEntity,
    relatedEntities: Array<IEntity>,
    relation: MetaRelation,
    mirror: MetaRelation,
    namespace: string | null,
  ): Promise<void> => {
    const store = getStore();
    const joinTableName = relation.joinTable as string;
    const table = resolveJoinTable(store, joinTableName, namespace);

    const ownerFindKeys = Object.entries(relation.findKeys ?? {});
    const targetFindKeys = Object.entries(mirror.findKeys ?? {});

    if (ownerFindKeys.length === 0 || targetFindKeys.length === 0) return;

    const ownerValues = ownerFindKeys.map(([, entityKey]) => (entity as any)[entityKey]);

    // Collect existing rows for this owner
    const existingKeys = new Set<string>();
    for (const [rowKey, row] of table) {
      const matches = ownerFindKeys.every(
        ([joinCol, entityKey]) => row[joinCol] === (entity as any)[entityKey],
      );
      if (matches) {
        existingKeys.add(rowKey);
      }
    }

    // Build desired rows
    const desiredRows = new Map<string, Record<string, unknown>>();
    for (const related of relatedEntities) {
      const targetValues = targetFindKeys.map(
        ([, entityKey]) => (related as any)[entityKey],
      );
      const rowKey = buildJoinRowKey(ownerValues, targetValues);

      const row: Record<string, unknown> = {};
      for (const [joinCol, entityKey] of ownerFindKeys) {
        row[joinCol] = (entity as any)[entityKey];
      }
      for (const [joinCol, entityKey] of targetFindKeys) {
        row[joinCol] = (related as any)[entityKey];
      }
      desiredRows.set(rowKey, row);
    }

    // Delete removed rows
    for (const existingKey of existingKeys) {
      if (!desiredRows.has(existingKey)) {
        table.delete(existingKey);
      }
    }

    // Insert new rows
    for (const [rowKey, row] of desiredRows) {
      if (!existingKeys.has(rowKey)) {
        table.set(rowKey, row);
      }
    }
  },

  delete: async (
    entity: IEntity,
    relation: MetaRelation,
    namespace: string | null,
  ): Promise<void> => {
    const store = getStore();
    const joinTableName = relation.joinTable as string;
    const table = resolveJoinTable(store, joinTableName, namespace);

    const ownerFindKeys = Object.entries(relation.findKeys ?? {});
    if (ownerFindKeys.length === 0) return;

    const toDelete: string[] = [];
    for (const [rowKey, row] of table) {
      const matches = ownerFindKeys.every(
        ([joinCol, entityKey]) => row[joinCol] === (entity as any)[entityKey],
      );
      if (matches) {
        toDelete.push(rowKey);
      }
    }

    for (const key of toDelete) {
      table.delete(key);
    }
  },
});
