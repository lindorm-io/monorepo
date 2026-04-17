import type { IEntity } from "../../../../../interfaces";
import type { MetaRelation } from "../../../../entity/types/metadata";
import type { PostgresQueryClient } from "../../types/postgres-query-client";
import { getJoinName } from "../../../../entity/utils/get-join-name";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";

/**
 * Synchronises M2M join table rows for a single entity. Deletes existing rows for
 * the entity's side, then inserts one row per related entity. Uses `relation.findKeys`
 * (NOT `joinKeys`) to resolve the entity's FK values in the join table, and the
 * mirror relation's `findKeys` for the related entity's FK values.
 */
export const syncJoinTableRows = async (
  entity: IEntity,
  relatedEntities: Array<IEntity>,
  relation: MetaRelation,
  mirror: MetaRelation,
  client: PostgresQueryClient,
  namespace: string | null,
): Promise<void> => {
  const joinTableName = relation.joinTable as string;
  const joinName = getJoinName(joinTableName, { namespace });
  const qualifiedTable = quoteQualifiedName(joinName.namespace, joinName.name);

  // Build owner column → value mapping (this entity's PK values in the join table)
  const ownerColumns: Array<{ column: string; value: unknown }> = [];
  for (const [joinCol, entityKey] of Object.entries(relation.findKeys ?? {})) {
    ownerColumns.push({ column: joinCol, value: (entity as any)[entityKey] });
  }

  if (ownerColumns.length === 0) return;

  // Query existing join rows for this entity
  const whereOwner = ownerColumns
    .map((c, i) => `${quoteIdentifier(c.column)} = $${i + 1}`)
    .join(" AND ");
  const ownerValues = ownerColumns.map((c) => c.value);

  const existingResult = await client.query(
    `SELECT * FROM ${qualifiedTable} WHERE ${whereOwner}`,
    ownerValues,
  );

  // Build the target column entries from the mirror's findKeys (A3 fix)
  const targetColEntries = Object.entries(mirror.findKeys ?? {});
  if (targetColEntries.length === 0) return;

  // Use JSON.stringify for safe composite key serialization (A11 fix)
  const existingRows = new Map<string, Array<unknown>>(
    existingResult.rows.map((row: any) => {
      const values = targetColEntries.map(([col]) => row[col]);
      return [JSON.stringify(values), values];
    }),
  );

  const desiredRows = new Map<string, Record<string, unknown>>();
  for (const related of relatedEntities) {
    const targetCols: Record<string, unknown> = {};
    const keyValues: Array<unknown> = [];
    for (const [joinCol, entityKey] of targetColEntries) {
      const value = (related as any)[entityKey];
      targetCols[joinCol] = value;
      keyValues.push(value);
    }
    desiredRows.set(JSON.stringify(keyValues), targetCols);
  }

  // DELETE removed rows
  const toRemove = [...existingRows.entries()].filter(([key]) => !desiredRows.has(key));
  for (const [, removedValues] of toRemove) {
    const removedWhere = [
      ...ownerColumns.map((c, i) => `${quoteIdentifier(c.column)} = $${i + 1}`),
      ...targetColEntries.map(
        ([col], i) => `${quoteIdentifier(col)} = $${ownerColumns.length + i + 1}`,
      ),
    ].join(" AND ");

    await client.query(`DELETE FROM ${qualifiedTable} WHERE ${removedWhere}`, [
      ...ownerValues,
      ...removedValues,
    ]);
  }

  // INSERT new rows (ON CONFLICT DO NOTHING)
  const toAdd = [...desiredRows.entries()].filter(([key]) => !existingRows.has(key));
  for (const [, targetCols] of toAdd) {
    const allCols = [
      ...ownerColumns.map((c) => c.column),
      ...targetColEntries.map(([col]) => col),
    ];
    const allValues = [
      ...ownerValues,
      ...targetColEntries.map(([col]) => targetCols[col]),
    ];

    const colList = allCols.map((c) => quoteIdentifier(c)).join(", ");
    const paramList = allValues.map((_, i) => `$${i + 1}`).join(", ");
    const conflictCols = colList;

    await client.query(
      `INSERT INTO ${qualifiedTable} (${colList}) VALUES (${paramList}) ON CONFLICT (${conflictCols}) DO NOTHING`,
      allValues,
    );
  }
};

export const deleteJoinTableRows = async (
  entity: IEntity,
  relation: MetaRelation,
  client: PostgresQueryClient,
  namespace: string | null,
): Promise<void> => {
  const joinTableName = relation.joinTable as string;
  const joinName = getJoinName(joinTableName, { namespace });
  const qualifiedTable = quoteQualifiedName(joinName.namespace, joinName.name);

  const ownerColumns: Array<{ column: string; value: unknown }> = [];
  for (const [joinCol, entityKey] of Object.entries(relation.findKeys ?? {})) {
    ownerColumns.push({ column: joinCol, value: (entity as any)[entityKey] });
  }

  if (ownerColumns.length === 0) return;

  const whereOwner = ownerColumns
    .map((c, i) => `${quoteIdentifier(c.column)} = $${i + 1}`)
    .join(" AND ");

  await client.query(
    `DELETE FROM ${qualifiedTable} WHERE ${whereOwner}`,
    ownerColumns.map((c) => c.value),
  );
};
