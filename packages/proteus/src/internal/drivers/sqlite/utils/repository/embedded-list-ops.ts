import type { IEntity } from "../../../../../interfaces";
import type { MetaEmbeddedList } from "#internal/entity/types/metadata";
import type { SqliteQueryClient } from "../../types/sqlite-query-client";
import { quoteIdentifier } from "../quote-identifier";
import { deserialise } from "#internal/entity/utils/deserialise";

/**
 * Insert collection table rows for an entity's @EmbeddedList fields.
 * Called after the parent entity is inserted/updated.
 */
export const insertEmbeddedListRows = (
  entity: IEntity,
  embeddedList: MetaEmbeddedList,
  client: SqliteQueryClient,
): void => {
  const array = (entity as any)[embeddedList.key];
  if (!array || !Array.isArray(array) || array.length === 0) return;

  const tableName = quoteIdentifier(embeddedList.tableName);
  const parentPkValue = (entity as any)[embeddedList.parentPkColumn];

  if (embeddedList.elementFields) {
    // Embeddable element rows
    const colNames = [
      quoteIdentifier(embeddedList.parentFkColumn),
      quoteIdentifier("__ordinal"),
      ...embeddedList.elementFields.map((f) => quoteIdentifier(f.name)),
    ];

    const allParams: Array<unknown> = [];
    const valueClauses: Array<string> = [];

    for (let ordinal = 0; ordinal < array.length; ordinal++) {
      const item = array[ordinal];
      const placeholders: Array<string> = [];

      placeholders.push("?");
      allParams.push(parentPkValue);

      placeholders.push("?");
      allParams.push(ordinal);

      for (const field of embeddedList.elementFields) {
        const value = item != null ? item[field.key] : null;
        const transformed =
          value != null && field.transform ? field.transform.to(value) : value;
        placeholders.push("?");
        allParams.push(transformed ?? null);
      }

      valueClauses.push(`(${placeholders.join(", ")})`);
    }

    const sql = `INSERT INTO ${tableName} (${colNames.join(", ")}) VALUES ${valueClauses.join(", ")}`;
    client.run(sql, allParams);
  } else {
    // Primitive element rows
    const colNames = [
      quoteIdentifier(embeddedList.parentFkColumn),
      quoteIdentifier("__ordinal"),
      quoteIdentifier("value"),
    ];

    const allParams: Array<unknown> = [];
    const valueClauses: Array<string> = [];

    for (let ordinal = 0; ordinal < array.length; ordinal++) {
      const item = array[ordinal];
      valueClauses.push("(?, ?, ?)");
      allParams.push(parentPkValue, ordinal, item ?? null);
    }

    const sql = `INSERT INTO ${tableName} (${colNames.join(", ")}) VALUES ${valueClauses.join(", ")}`;
    client.run(sql, allParams);
  }
};

/**
 * Delete all collection table rows for a parent entity.
 */
export const deleteEmbeddedListRows = (
  entity: IEntity,
  embeddedList: MetaEmbeddedList,
  client: SqliteQueryClient,
): void => {
  const tableName = quoteIdentifier(embeddedList.tableName);
  const parentPkValue = (entity as any)[embeddedList.parentPkColumn];

  const sql = `DELETE FROM ${tableName} WHERE ${quoteIdentifier(embeddedList.parentFkColumn)} = ?`;
  client.run(sql, [parentPkValue]);
};

/**
 * Load collection table rows for a parent entity and set the array on the entity.
 */
export const loadEmbeddedListRows = (
  entity: IEntity,
  embeddedList: MetaEmbeddedList,
  client: SqliteQueryClient,
): void => {
  const tableName = quoteIdentifier(embeddedList.tableName);
  const parentPkValue = (entity as any)[embeddedList.parentPkColumn];

  const sql = `SELECT * FROM ${tableName} WHERE ${quoteIdentifier(embeddedList.parentFkColumn)} = ? ORDER BY ${quoteIdentifier("__ordinal")}`;
  const rows = client.all(sql, [parentPkValue]);

  if (rows.length === 0) {
    (entity as any)[embeddedList.key] = [];
    return;
  }

  if (embeddedList.elementFields && embeddedList.elementConstructor) {
    const EmbeddableClass = embeddedList.elementConstructor();
    const items: Array<unknown> = [];

    for (const row of rows) {
      const instance = new EmbeddableClass();
      for (const field of embeddedList.elementFields) {
        const raw = row[field.name];
        if (raw === null || raw === undefined) {
          instance[field.key] = raw;
        } else {
          let value = deserialise(raw, field.type);
          if (field.transform) {
            value = field.transform.from(value);
          }
          instance[field.key] = value;
        }
      }
      items.push(instance);
    }

    (entity as any)[embeddedList.key] = items;
  } else {
    (entity as any)[embeddedList.key] = rows.map((row: any) => {
      const raw = row.value;
      if (raw === null || raw === undefined) return raw;
      return embeddedList.elementType ? deserialise(raw, embeddedList.elementType) : raw;
    });
  }
};

/**
 * Batch-load collection table rows for multiple entities at once.
 * SQLite does not support `= ANY($1)`, so we use `IN (?, ?, ...)`.
 */
export const loadEmbeddedListRowsBatch = (
  entities: Array<IEntity>,
  embeddedList: MetaEmbeddedList,
  client: SqliteQueryClient,
): void => {
  if (entities.length === 0) return;

  const tableName = quoteIdentifier(embeddedList.tableName);
  const fkCol = quoteIdentifier(embeddedList.parentFkColumn);
  const pkValues = entities.map((e) => (e as any)[embeddedList.parentPkColumn]);

  const placeholders = pkValues.map(() => "?").join(", ");
  const sql = `SELECT * FROM ${tableName} WHERE ${fkCol} IN (${placeholders}) ORDER BY ${quoteIdentifier("__ordinal")}`;
  const rows = client.all(sql, pkValues);

  // Group rows by FK value
  const grouped = new Map<unknown, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const fkValue = row[embeddedList.parentFkColumn];
    let group = grouped.get(fkValue);
    if (!group) {
      group = [];
      grouped.set(fkValue, group);
    }
    group.push(row);
  }

  // Distribute results to entities
  for (const entity of entities) {
    const pkValue = (entity as any)[embeddedList.parentPkColumn];
    const entityRows = grouped.get(pkValue);

    if (!entityRows || entityRows.length === 0) {
      (entity as any)[embeddedList.key] = [];
      continue;
    }

    if (embeddedList.elementFields && embeddedList.elementConstructor) {
      const EmbeddableClass = embeddedList.elementConstructor();
      const items: Array<unknown> = [];

      for (const row of entityRows) {
        const instance = new EmbeddableClass();
        for (const field of embeddedList.elementFields) {
          const raw = row[field.name];
          if (raw === null || raw === undefined) {
            instance[field.key] = raw;
          } else {
            let value = deserialise(raw, field.type);
            if (field.transform) {
              value = field.transform.from(value);
            }
            instance[field.key] = value;
          }
        }
        items.push(instance);
      }

      (entity as any)[embeddedList.key] = items;
    } else {
      (entity as any)[embeddedList.key] = entityRows.map((row: any) => {
        const raw = row.value;
        if (raw === null || raw === undefined) return raw;
        return embeddedList.elementType
          ? deserialise(raw, embeddedList.elementType)
          : raw;
      });
    }
  }
};

/**
 * Save embedded list rows (full replacement strategy):
 * 1. DELETE all existing rows for the parent FK
 * 2. INSERT new rows
 */
export const saveEmbeddedListRows = (
  entity: IEntity,
  embeddedList: MetaEmbeddedList,
  client: SqliteQueryClient,
): void => {
  deleteEmbeddedListRows(entity, embeddedList, client);
  insertEmbeddedListRows(entity, embeddedList, client);
};
