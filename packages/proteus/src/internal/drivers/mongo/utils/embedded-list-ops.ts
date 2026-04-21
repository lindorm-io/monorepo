import type { ClientSession, Db, Document } from "mongodb";
import type { IEntity } from "../../../../interfaces/index.js";
import type { MetaEmbeddedList } from "../../../entity/types/metadata.js";
import { deserialise } from "../../../entity/utils/deserialise.js";

const sessionOpts = (session?: ClientSession): { session: ClientSession } | undefined =>
  session ? { session } : undefined;

/**
 * Save embedded list rows for a MongoDB collection (full replacement).
 * 1. DELETE all existing rows for the parent FK
 * 2. INSERT new rows with ordinal ordering
 */
export const saveMongoEmbeddedListRows = async (
  entity: IEntity,
  embeddedList: MetaEmbeddedList,
  db: Db,
  session?: ClientSession,
): Promise<void> => {
  await deleteMongoEmbeddedListRows(entity, embeddedList, db, session);
  await insertMongoEmbeddedListRows(entity, embeddedList, db, session);
};

/**
 * Insert collection documents for an entity's @EmbeddedList fields.
 */
export const insertMongoEmbeddedListRows = async (
  entity: IEntity,
  embeddedList: MetaEmbeddedList,
  db: Db,
  session?: ClientSession,
): Promise<void> => {
  const array = (entity as any)[embeddedList.key];
  if (!array || !Array.isArray(array) || array.length === 0) return;

  const collection = db.collection(embeddedList.tableName);
  const parentPkValue = (entity as any)[embeddedList.parentPkColumn];
  const docs: Array<Document> = [];

  if (embeddedList.elementFields) {
    for (let ordinal = 0; ordinal < array.length; ordinal++) {
      const item = array[ordinal];
      const doc: Document = {
        [embeddedList.parentFkColumn]: parentPkValue,
        __ordinal: ordinal,
      };

      for (const field of embeddedList.elementFields) {
        const value = item != null ? item[field.key] : null;
        const transformed =
          value != null && field.transform ? field.transform.to(value) : value;
        doc[field.name] = transformed ?? null;
      }

      docs.push(doc);
    }
  } else {
    for (let ordinal = 0; ordinal < array.length; ordinal++) {
      docs.push({
        [embeddedList.parentFkColumn]: parentPkValue,
        __ordinal: ordinal,
        value: array[ordinal] ?? null,
      });
    }
  }

  if (docs.length > 0) {
    await collection.insertMany(docs, {
      ordered: true,
      ...sessionOpts(session),
    });
  }
};

/**
 * Delete all collection documents for a parent entity.
 */
export const deleteMongoEmbeddedListRows = async (
  entity: IEntity,
  embeddedList: MetaEmbeddedList,
  db: Db,
  session?: ClientSession,
): Promise<void> => {
  const collection = db.collection(embeddedList.tableName);
  const parentPkValue = (entity as any)[embeddedList.parentPkColumn];

  await collection.deleteMany(
    { [embeddedList.parentFkColumn]: parentPkValue },
    sessionOpts(session),
  );
};

/**
 * Load embedded list data for a single entity from its collection.
 */
export const loadMongoEmbeddedListRows = async (
  entity: IEntity,
  embeddedList: MetaEmbeddedList,
  db: Db,
  session?: ClientSession,
): Promise<void> => {
  const collection = db.collection(embeddedList.tableName);
  const parentPkValue = (entity as any)[embeddedList.parentPkColumn];

  const docs = await collection
    .find({ [embeddedList.parentFkColumn]: parentPkValue }, sessionOpts(session))
    .sort({ __ordinal: 1 })
    .toArray();

  if (docs.length === 0) {
    (entity as any)[embeddedList.key] = [];
    return;
  }

  if (embeddedList.elementFields && embeddedList.elementConstructor) {
    const EmbeddableClass = embeddedList.elementConstructor();
    const items: Array<unknown> = [];

    for (const doc of docs) {
      const instance = new EmbeddableClass();
      for (const field of embeddedList.elementFields) {
        const raw = doc[field.name];
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
    (entity as any)[embeddedList.key] = docs.map((doc) => {
      const raw = doc.value;
      if (raw === null || raw === undefined) return raw;
      return embeddedList.elementType ? deserialise(raw, embeddedList.elementType) : raw;
    });
  }
};

/**
 * Batch-load embedded list data for multiple entities at once.
 * Uses a single query with $in on the parent FK field, then distributes
 * results back to each entity.
 */
export const loadMongoEmbeddedListRowsBatch = async (
  entities: Array<IEntity>,
  embeddedList: MetaEmbeddedList,
  db: Db,
  session?: ClientSession,
): Promise<void> => {
  if (entities.length === 0) return;

  const collection = db.collection(embeddedList.tableName);
  const pkValues = entities.map((e) => (e as any)[embeddedList.parentPkColumn]);

  const docs = await collection
    .find({ [embeddedList.parentFkColumn]: { $in: pkValues } }, sessionOpts(session))
    .sort({ __ordinal: 1 })
    .toArray();

  // Group documents by FK value.
  // NOTE: String() coercion assumes consistent PK types within an entity.
  const grouped = new Map<string, Array<Document>>();
  for (const doc of docs) {
    const fkValue = String(doc[embeddedList.parentFkColumn]);
    let group = grouped.get(fkValue);
    if (!group) {
      group = [];
      grouped.set(fkValue, group);
    }
    group.push(doc);
  }

  // Distribute results to entities
  for (const entity of entities) {
    const pkValue = String((entity as any)[embeddedList.parentPkColumn]);
    const rows = grouped.get(pkValue);

    if (!rows || rows.length === 0) {
      (entity as any)[embeddedList.key] = [];
      continue;
    }

    if (embeddedList.elementFields && embeddedList.elementConstructor) {
      const EmbeddableClass = embeddedList.elementConstructor();
      const items: Array<unknown> = [];

      for (const doc of rows) {
        const instance = new EmbeddableClass();
        for (const field of embeddedList.elementFields) {
          const raw = doc[field.name];
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
      (entity as any)[embeddedList.key] = rows.map((doc) => {
        const raw = doc.value;
        if (raw === null || raw === undefined) return raw;
        return embeddedList.elementType
          ? deserialise(raw, embeddedList.elementType)
          : raw;
      });
    }
  }
};
