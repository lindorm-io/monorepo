import type { IEntity } from "../../../../interfaces/index.js";
import type { MetaEmbeddedList } from "../../../entity/types/metadata.js";
import type { MemoryCollectionTable, MemoryStore } from "../types/memory-store.js";
import { dehydrateElementValue } from "../../../entity/utils/dehydrate-element-value.js";
import { deserialise } from "../../../entity/utils/deserialise.js";
import { buildPrimitiveElementField } from "../../../entity/utils/primitive-element-field.js";

const getCollectionTable = (
  store: MemoryStore,
  namespace: string | null,
  tableName: string,
): MemoryCollectionTable => {
  const key = namespace ? `${namespace}.${tableName}` : tableName;
  let table = store.collectionTables.get(key);
  if (!table) {
    table = new Map();
    store.collectionTables.set(key, table);
  }
  return table;
};

/**
 * The parent FK column holds the parent's PK value, so it writes through the
 * parent PK's own pipeline instead of being pushed raw into the row. Memory
 * passes no driver coercion, exactly as it does for the element columns.
 */
const dehydrateParentPk = (entity: IEntity, embeddedList: MetaEmbeddedList): unknown =>
  dehydrateElementValue(
    (entity as any)[embeddedList.parentPkColumn],
    embeddedList.parentPkField,
    embeddedList,
  );

/**
 * Save embedded list rows for an entity (full replacement).
 */
export const saveMemoryEmbeddedListRows = (
  entity: IEntity,
  embeddedList: MetaEmbeddedList,
  store: MemoryStore,
  namespace: string | null,
): void => {
  const table = getCollectionTable(store, namespace, embeddedList.tableName);
  const parentPkValue = String((entity as any)[embeddedList.parentPkColumn]);

  // Delete existing rows
  table.delete(parentPkValue);

  const array = (entity as any)[embeddedList.key];
  if (!array || !Array.isArray(array) || array.length === 0) return;

  const rows: Array<Record<string, unknown>> = [];

  if (embeddedList.elementFields) {
    // Embeddable elements
    for (const item of array) {
      const row: Record<string, unknown> = {
        [embeddedList.parentFkColumn]: dehydrateParentPk(entity, embeddedList),
      };
      for (const field of embeddedList.elementFields) {
        const value = item != null ? item[field.key] : null;
        // No driver coercion: a memory row is structuredClone'd, so every JS
        // value is stored natively (the same reason MemoryExecutor dehydrates
        // entity columns with no `coerce`).
        row[field.key] = dehydrateElementValue(value, field, embeddedList);
      }
      rows.push(row);
    }
  } else {
    // Primitive elements. No MetaField of its own, so it borrows the synthetic
    // one the DDL projected the "value" column from.
    const elementField = buildPrimitiveElementField(embeddedList.elementType);

    for (const item of array) {
      rows.push({
        [embeddedList.parentFkColumn]: dehydrateParentPk(entity, embeddedList),
        value: dehydrateElementValue(item, elementField, embeddedList),
      });
    }
  }

  table.set(parentPkValue, rows);
};

/**
 * Load embedded list rows for an entity and set the array on the entity.
 */
export const loadMemoryEmbeddedListRows = (
  entity: IEntity,
  embeddedList: MetaEmbeddedList,
  store: MemoryStore,
  namespace: string | null,
): void => {
  const table = getCollectionTable(store, namespace, embeddedList.tableName);
  const parentPkValue = String((entity as any)[embeddedList.parentPkColumn]);
  const rows = table.get(parentPkValue);

  if (!rows || rows.length === 0) {
    (entity as any)[embeddedList.key] = [];
    return;
  }

  if (embeddedList.elementFields && embeddedList.elementConstructor) {
    // Embeddable elements: hydrate each row
    const EmbeddableClass = embeddedList.elementConstructor();
    const items: Array<unknown> = [];

    for (const row of rows) {
      const instance = new EmbeddableClass();
      for (const field of embeddedList.elementFields) {
        const raw = row[field.key];
        if (raw === null || raw === undefined) {
          instance[field.key] = raw;
        } else {
          let value = deserialise(raw, field.type, field.mode, field.arrayType);
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
    // Primitive elements: extract "value" column
    (entity as any)[embeddedList.key] = rows.map((row) => {
      const raw = row.value;
      if (raw === null || raw === undefined) return raw;
      return embeddedList.elementType ? deserialise(raw, embeddedList.elementType) : raw;
    });
  }
};

/**
 * Delete all collection table rows for an entity.
 */
export const deleteMemoryEmbeddedListRows = (
  entity: IEntity,
  embeddedList: MetaEmbeddedList,
  store: MemoryStore,
  namespace: string | null,
): void => {
  const table = getCollectionTable(store, namespace, embeddedList.tableName);
  const parentPkValue = String((entity as any)[embeddedList.parentPkColumn]);
  table.delete(parentPkValue);
};
