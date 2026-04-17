import type { IEntity } from "../../../../../interfaces";
import type { MetaRelation } from "../../../../entity/types/metadata";
import type { MysqlQueryClient } from "../../types/mysql-query-client";
import { getJoinName } from "../../../../entity/utils/get-join-name";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";

/**
 * Synchronises M2M join table rows for a single entity. Deletes removed rows
 * and inserts new rows. Uses `relation.findKeys` for the entity's FK values
 * and the mirror relation's `findKeys` for related entity's FK values.
 *
 * MySQL adaptation: `?` params, backtick quoting, async client calls,
 * INSERT ... ON DUPLICATE KEY UPDATE (no-op variant).
 */
export const syncJoinTableRows = async (
  entity: IEntity,
  relatedEntities: Array<IEntity>,
  relation: MetaRelation,
  mirror: MetaRelation,
  client: MysqlQueryClient,
  namespace: string | null,
): Promise<void> => {
  const joinTableName = relation.joinTable as string;
  const joinName = getJoinName(joinTableName, { namespace });
  const quotedTable = quoteQualifiedName(namespace, joinName.name);

  // Build owner column -> value mapping (this entity's PK values in the join table)
  const ownerColumns: Array<{ column: string; value: unknown }> = [];
  for (const [joinCol, entityKey] of Object.entries(relation.findKeys ?? {})) {
    ownerColumns.push({ column: joinCol, value: (entity as any)[entityKey] });
  }

  if (ownerColumns.length === 0) return;

  // Query existing join rows for this entity
  const whereOwner = ownerColumns
    .map((c) => `${quoteIdentifier(c.column)} = ?`)
    .join(" AND ");
  const ownerValues = ownerColumns.map((c) => c.value);

  const { rows: existingRows } = await client.query(
    `SELECT * FROM ${quotedTable} WHERE ${whereOwner}`,
    ownerValues,
  );

  // Build the target column entries from the mirror's findKeys
  const targetColEntries = Object.entries(mirror.findKeys ?? {});
  if (targetColEntries.length === 0) return;

  // Use JSON.stringify for safe composite key serialization
  const existingMap = new Map<string, Array<unknown>>(
    existingRows.map((row: any) => {
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
  const toRemove = [...existingMap.entries()].filter(([key]) => !desiredRows.has(key));
  for (const [, removedValues] of toRemove) {
    const removedWhere = [
      ...ownerColumns.map((c) => `${quoteIdentifier(c.column)} = ?`),
      ...targetColEntries.map(([col]) => `${quoteIdentifier(col)} = ?`),
    ].join(" AND ");

    await client.query(`DELETE FROM ${quotedTable} WHERE ${removedWhere}`, [
      ...ownerValues,
      ...removedValues,
    ]);
  }

  // INSERT new rows (ON DUPLICATE KEY UPDATE — no-op)
  const toAdd = [...desiredRows.entries()].filter(([key]) => !existingMap.has(key));
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
    const paramList = allValues.map(() => "?").join(", ");
    // MySQL uses ON DUPLICATE KEY UPDATE with a no-op assignment
    const firstCol = quoteIdentifier(allCols[0]);

    await client.query(
      `INSERT INTO ${quotedTable} (${colList}) VALUES (${paramList}) ON DUPLICATE KEY UPDATE ${firstCol} = ${firstCol}`,
      allValues,
    );
  }
};

export const deleteJoinTableRows = async (
  entity: IEntity,
  relation: MetaRelation,
  client: MysqlQueryClient,
  namespace: string | null,
): Promise<void> => {
  const joinTableName = relation.joinTable as string;
  const joinName = getJoinName(joinTableName, { namespace });
  const quotedTable = quoteQualifiedName(namespace, joinName.name);

  const ownerColumns: Array<{ column: string; value: unknown }> = [];
  for (const [joinCol, entityKey] of Object.entries(relation.findKeys ?? {})) {
    ownerColumns.push({ column: joinCol, value: (entity as any)[entityKey] });
  }

  if (ownerColumns.length === 0) return;

  const whereOwner = ownerColumns
    .map((c) => `${quoteIdentifier(c.column)} = ?`)
    .join(" AND ");

  await client.query(
    `DELETE FROM ${quotedTable} WHERE ${whereOwner}`,
    ownerColumns.map((c) => c.value),
  );
};
