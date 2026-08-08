import type { IEntity } from "../../../../../interfaces/index.js";
import type { MetaEmbeddedList } from "../../../../entity/types/metadata.js";
import type { MysqlQueryClient } from "../../types/mysql-query-client.js";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier.js";
import { dehydrateElementValue } from "../../../../entity/utils/dehydrate-element-value.js";
import { deserialise } from "../../../../entity/utils/deserialise.js";
import { buildPrimitiveElementField } from "../../../../entity/utils/primitive-element-field.js";
import { coerceWriteValue } from "../query/coerce-value.js";

/**
 * The parent FK column holds the parent's PK value, so it writes through the
 * parent PK's own pipeline — same transform, same driver coercion — instead of
 * being pushed raw into the binder.
 */
const dehydrateParentPk = (entity: IEntity, embeddedList: MetaEmbeddedList): unknown =>
  dehydrateElementValue(
    (entity as any)[embeddedList.parentPkColumn],
    embeddedList.parentPkField,
    embeddedList,
    (v) => coerceWriteValue(v, embeddedList.parentPkField?.type ?? null),
  );

/**
 * Insert collection table rows for an entity's @EmbeddedList fields.
 * Called after the parent entity is inserted/updated.
 */
export const insertEmbeddedListRows = async (
  entity: IEntity,
  embeddedList: MetaEmbeddedList,
  client: MysqlQueryClient,
  namespace: string | null,
): Promise<void> => {
  const array = (entity as any)[embeddedList.key];
  if (!array || !Array.isArray(array) || array.length === 0) return;

  const tableName = quoteQualifiedName(namespace, embeddedList.tableName);
  const parentPkValue = dehydrateParentPk(entity, embeddedList);

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
        placeholders.push("?");
        allParams.push(
          dehydrateElementValue(value, field, embeddedList, (v) =>
            coerceWriteValue(v, field.type),
          ),
        );
      }

      valueClauses.push(`(${placeholders.join(", ")})`);
    }

    const sql = `INSERT INTO ${tableName} (${colNames.join(", ")}) VALUES ${valueClauses.join(", ")}`;
    await client.query(sql, allParams);
  } else {
    // Primitive element rows
    const colNames = [
      quoteIdentifier(embeddedList.parentFkColumn),
      quoteIdentifier("__ordinal"),
      quoteIdentifier("value"),
    ];

    // A primitive element has no MetaField of its own, so it borrows the
    // synthetic one the DDL projected the "value" column from — that is what
    // carries `elementType` into the coercion.
    const elementField = buildPrimitiveElementField(embeddedList.elementType);

    const allParams: Array<unknown> = [];
    const valueClauses: Array<string> = [];

    for (let ordinal = 0; ordinal < array.length; ordinal++) {
      const item = array[ordinal];
      valueClauses.push("(?, ?, ?)");
      allParams.push(
        parentPkValue,
        ordinal,
        dehydrateElementValue(item, elementField, embeddedList, (v) =>
          coerceWriteValue(v, elementField.type),
        ),
      );
    }

    const sql = `INSERT INTO ${tableName} (${colNames.join(", ")}) VALUES ${valueClauses.join(", ")}`;
    await client.query(sql, allParams);
  }
};

/**
 * Delete all collection table rows for a parent entity.
 */
export const deleteEmbeddedListRows = async (
  entity: IEntity,
  embeddedList: MetaEmbeddedList,
  client: MysqlQueryClient,
  namespace: string | null,
): Promise<void> => {
  const tableName = quoteQualifiedName(namespace, embeddedList.tableName);
  const parentPkValue = dehydrateParentPk(entity, embeddedList);

  const sql = `DELETE FROM ${tableName} WHERE ${quoteIdentifier(embeddedList.parentFkColumn)} = ?`;
  await client.query(sql, [parentPkValue]);
};

/**
 * Load collection table rows for a parent entity and set the array on the entity.
 */
export const loadEmbeddedListRows = async (
  entity: IEntity,
  embeddedList: MetaEmbeddedList,
  client: MysqlQueryClient,
  namespace: string | null,
): Promise<void> => {
  const tableName = quoteQualifiedName(namespace, embeddedList.tableName);
  const parentPkValue = dehydrateParentPk(entity, embeddedList);

  const sql = `SELECT * FROM ${tableName} WHERE ${quoteIdentifier(embeddedList.parentFkColumn)} = ? ORDER BY ${quoteIdentifier("__ordinal")}`;
  const { rows } = await client.query(sql, [parentPkValue]);

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
        const raw = (row as any)[field.name];
        if (raw === null || raw === undefined) {
          instance[field.key] = raw;
        } else {
          let value = deserialise(raw, field.type, field.mode);
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
 * MySQL supports `IN (?, ?, ...)`.
 */
export const loadEmbeddedListRowsBatch = async (
  entities: Array<IEntity>,
  embeddedList: MetaEmbeddedList,
  client: MysqlQueryClient,
  namespace: string | null,
): Promise<void> => {
  if (entities.length === 0) return;

  const tableName = quoteQualifiedName(namespace, embeddedList.tableName);
  const fkCol = quoteIdentifier(embeddedList.parentFkColumn);
  const pkValues = entities.map((e) => dehydrateParentPk(e, embeddedList));

  const placeholders = pkValues.map(() => "?").join(", ");
  const sql = `SELECT * FROM ${tableName} WHERE ${fkCol} IN (${placeholders}) ORDER BY ${quoteIdentifier("__ordinal")}`;
  const { rows } = await client.query(sql, pkValues);

  // Group rows by FK value.
  //
  // The FK arrives RAW from the driver while the parent's PK is already
  // hydrated, and the two are not the same JS type: mysql2 runs with
  // `bigNumberStrings: false`, so a BIGINT inside the safe range comes back as
  // a number, against a hydrated `bigint` PK. `Map` compares keys with
  // SameValueZero, so `1` and `1n` are two different keys and every parent
  // silently received an empty list. Correlate on the decimal string both
  // sides agree on — same as the memory and mongo drivers. This is the local
  // Map key only: the column type, the stored value and the query parameters
  // are untouched.
  const grouped = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const fkValue = String((row as any)[embeddedList.parentFkColumn]);
    let group = grouped.get(fkValue);
    if (!group) {
      group = [];
      grouped.set(fkValue, group);
    }
    group.push(row);
  }

  // Distribute results to entities
  for (const entity of entities) {
    const pkValue = String((entity as any)[embeddedList.parentPkColumn]);
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
          const raw = (row as any)[field.name];
          if (raw === null || raw === undefined) {
            instance[field.key] = raw;
          } else {
            let value = deserialise(raw, field.type, field.mode);
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
export const saveEmbeddedListRows = async (
  entity: IEntity,
  embeddedList: MetaEmbeddedList,
  client: MysqlQueryClient,
  namespace: string | null,
): Promise<void> => {
  await deleteEmbeddedListRows(entity, embeddedList, client, namespace);
  await insertEmbeddedListRows(entity, embeddedList, client, namespace);
};
