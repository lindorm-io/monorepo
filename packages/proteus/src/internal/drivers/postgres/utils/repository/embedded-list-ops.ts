import type { IEntity } from "../../../../../interfaces/index.js";
import type { MetaEmbeddedList } from "../../../../entity/types/metadata.js";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier.js";
import { deserialise } from "../../../../entity/utils/deserialise.js";

/**
 * Insert collection table rows for an entity's @EmbeddedList fields.
 * Called after the parent entity is inserted/updated.
 */
export const insertEmbeddedListRows = async (
  entity: IEntity,
  embeddedList: MetaEmbeddedList,
  client: PostgresQueryClient,
  namespace: string | null,
): Promise<void> => {
  const array = (entity as any)[embeddedList.key];
  if (!array || !Array.isArray(array) || array.length === 0) return;

  const qualifiedTable = quoteQualifiedName(namespace, embeddedList.tableName);
  const parentPkValue = (entity as any)[embeddedList.parentPkColumn];

  if (embeddedList.elementFields) {
    // Embeddable element rows
    const colNames = [
      quoteIdentifier(embeddedList.parentFkColumn),
      quoteIdentifier("__ordinal"),
      ...embeddedList.elementFields.map((f) => quoteIdentifier(f.name)),
    ];

    let paramIdx = 1;
    const allParams: Array<unknown> = [];
    const valueClauses: Array<string> = [];

    for (let ordinal = 0; ordinal < array.length; ordinal++) {
      const item = array[ordinal];
      const placeholders: Array<string> = [];
      placeholders.push(`$${paramIdx++}`);
      allParams.push(parentPkValue);

      placeholders.push(`$${paramIdx++}`);
      allParams.push(ordinal);

      for (const field of embeddedList.elementFields) {
        const value = item != null ? item[field.key] : null;
        const transformed =
          value != null && field.transform ? field.transform.to(value) : value;
        placeholders.push(`$${paramIdx++}`);
        allParams.push(transformed ?? null);
      }

      valueClauses.push(`(${placeholders.join(", ")})`);
    }

    const sql = `INSERT INTO ${qualifiedTable} (${colNames.join(", ")}) VALUES ${valueClauses.join(", ")}`;
    await client.query(sql, allParams);
  } else {
    // Primitive element rows
    const colNames = [
      quoteIdentifier(embeddedList.parentFkColumn),
      quoteIdentifier("__ordinal"),
      quoteIdentifier("value"),
    ];

    let paramIdx = 1;
    const allParams: Array<unknown> = [];
    const valueClauses: Array<string> = [];

    for (let ordinal = 0; ordinal < array.length; ordinal++) {
      const item = array[ordinal];
      valueClauses.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
      allParams.push(parentPkValue, ordinal, item ?? null);
    }

    const sql = `INSERT INTO ${qualifiedTable} (${colNames.join(", ")}) VALUES ${valueClauses.join(", ")}`;
    await client.query(sql, allParams);
  }
};

/**
 * Delete all collection table rows for a parent entity.
 */
export const deleteEmbeddedListRows = async (
  entity: IEntity,
  embeddedList: MetaEmbeddedList,
  client: PostgresQueryClient,
  namespace: string | null,
): Promise<void> => {
  const qualifiedTable = quoteQualifiedName(namespace, embeddedList.tableName);
  const parentPkValue = (entity as any)[embeddedList.parentPkColumn];

  const sql = `DELETE FROM ${qualifiedTable} WHERE ${quoteIdentifier(embeddedList.parentFkColumn)} = $1`;
  await client.query(sql, [parentPkValue]);
};

/**
 * Load collection table rows for a parent entity and set the array on the entity.
 */
export const loadEmbeddedListRows = async (
  entity: IEntity,
  embeddedList: MetaEmbeddedList,
  client: PostgresQueryClient,
  namespace: string | null,
): Promise<void> => {
  const qualifiedTable = quoteQualifiedName(namespace, embeddedList.tableName);
  const parentPkValue = (entity as any)[embeddedList.parentPkColumn];

  const sql = `SELECT * FROM ${qualifiedTable} WHERE ${quoteIdentifier(embeddedList.parentFkColumn)} = $1 ORDER BY ${quoteIdentifier("__ordinal")}`;
  const result = await client.query(sql, [parentPkValue]);

  if (result.rows.length === 0) {
    (entity as any)[embeddedList.key] = [];
    return;
  }

  if (embeddedList.elementFields && embeddedList.elementConstructor) {
    // Embeddable element: hydrate each row into an embeddable instance
    const EmbeddableClass = embeddedList.elementConstructor();
    const items: Array<unknown> = [];

    for (const row of result.rows) {
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
    // Primitive element: extract "value" column
    (entity as any)[embeddedList.key] = result.rows.map((row: any) => {
      const raw = row.value;
      if (raw === null || raw === undefined) return raw;
      return embeddedList.elementType ? deserialise(raw, embeddedList.elementType) : raw;
    });
  }
};

/**
 * Batch-load collection table rows for multiple entities at once.
 * Uses a single SELECT ... WHERE fk = ANY($1) query per embedded list,
 * then distributes results back to each entity by FK value.
 */
export const loadEmbeddedListRowsBatch = async (
  entities: Array<IEntity>,
  embeddedList: MetaEmbeddedList,
  client: PostgresQueryClient,
  namespace: string | null,
): Promise<void> => {
  if (entities.length === 0) return;

  const qualifiedTable = quoteQualifiedName(namespace, embeddedList.tableName);
  const fkCol = quoteIdentifier(embeddedList.parentFkColumn);
  const pkValues = entities.map((e) => (e as any)[embeddedList.parentPkColumn]);

  const sql = `SELECT * FROM ${qualifiedTable} WHERE ${fkCol} = ANY($1) ORDER BY ${quoteIdentifier("__ordinal")}`;
  const result = await client.query(sql, [pkValues]);

  // Group rows by FK value
  const grouped = new Map<unknown, Array<Record<string, unknown>>>();
  for (const row of result.rows) {
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
    const rows = grouped.get(pkValue);

    if (!rows || rows.length === 0) {
      (entity as any)[embeddedList.key] = [];
      continue;
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
 *
 * This does not participate in dirty-checking — collection rows are always
 * fully replaced on every save()/update() call, regardless of whether the
 * array actually changed. Embedded list mutations alone do not bump the
 * parent entity's version or UpdateDate.
 */
export const saveEmbeddedListRows = async (
  entity: IEntity,
  embeddedList: MetaEmbeddedList,
  client: PostgresQueryClient,
  namespace: string | null,
): Promise<void> => {
  await deleteEmbeddedListRows(entity, embeddedList, client, namespace);
  await insertEmbeddedListRows(entity, embeddedList, client, namespace);
};
