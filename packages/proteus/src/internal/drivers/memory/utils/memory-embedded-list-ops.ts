import type { IEntity } from "../../../../interfaces";
import type { MetaEmbeddedList } from "#internal/entity/types/metadata";
import type { MemoryCollectionTable, MemoryStore } from "../types/memory-store";
import { deserialise } from "#internal/entity/utils/deserialise";

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
        [embeddedList.parentFkColumn]: (entity as any)[embeddedList.parentPkColumn],
      };
      for (const field of embeddedList.elementFields) {
        const value = item != null ? item[field.key] : null;
        row[field.key] =
          value != null && field.transform ? field.transform.to(value) : value;
      }
      rows.push(row);
    }
  } else {
    // Primitive elements
    for (const item of array) {
      rows.push({
        [embeddedList.parentFkColumn]: (entity as any)[embeddedList.parentPkColumn],
        value: item,
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
