import type { IAmphora } from "@lindorm/amphora";
import type { Dict } from "@lindorm/types";
import type { Document } from "mongodb";
import type { IEntity } from "../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { defaultHydrateEntity } from "../../../entity/utils/default-hydrate-entity.js";
import { resolvePolymorphicMetadata } from "../../../entity/utils/resolve-polymorphic-metadata.js";
import { cloneDocument } from "./clone-with-getters.js";

/**
 * Build a reverse field name mapping from DB name -> entity key.
 * This allows hydration from MongoDB documents (which use DB names)
 * back to entity property keys.
 */
const buildReverseFieldMap = (metadata: EntityMetadata): Map<string, string> => {
  const map = new Map<string, string>();
  for (const field of metadata.fields) {
    map.set(field.name, field.key);
  }
  return map;
};

/**
 * Convert a MongoDB document back into a flat Dict keyed by entity field keys.
 * This is the reverse of dehydrateEntity — it maps:
 * - _id -> PK field(s)
 * - DB column names -> entity property keys
 */
const documentToRow = (doc: Document, metadata: EntityMetadata): Dict => {
  const row: Dict = {};
  const cloned = cloneDocument(doc);
  const reverseMap = buildReverseFieldMap(metadata);
  const pkSet = new Set(metadata.primaryKeys);

  // Extract PK values from _id
  if (metadata.primaryKeys.length === 1) {
    row[metadata.primaryKeys[0]] = cloned._id;
  } else {
    // Compound _id — decompose into individual PK fields
    const compoundId = cloned._id as Record<string, unknown>;
    for (const pkKey of metadata.primaryKeys) {
      row[pkKey] = compoundId[pkKey];
    }
  }

  // Map remaining fields from DB names to entity keys
  for (const [dbName, value] of Object.entries(cloned)) {
    if (dbName === "_id") continue;

    const entityKey = reverseMap.get(dbName);
    if (entityKey && !pkSet.has(entityKey)) {
      row[entityKey] = value;
    } else if (!entityKey) {
      // FK columns from relations may not be in the field list
      // Pass them through as-is
      row[dbName] = value;
    }
  }

  return row;
};

/**
 * Hydrate a MongoDB document into a typed entity instance.
 *
 * 1. Clone the document to strip MongoDB driver getters
 * 2. Map DB field names back to entity property keys
 * 3. Decompose compound _id into individual PK fields
 * 4. Resolve polymorphic metadata for single-table inheritance
 * 5. Delegate to defaultHydrateEntity for deserialization and snapshot storage
 */
export const hydrateEntity = <E extends IEntity>(
  doc: Document,
  metadata: EntityMetadata,
  amphora?: IAmphora,
  snapshot?: boolean,
): E => {
  const row = documentToRow(doc, metadata);
  const effectiveMetadata = resolvePolymorphicMetadata(row, metadata);
  return defaultHydrateEntity<E>(row, effectiveMetadata, {
    snapshot: snapshot ?? true,
    hooks: true,
    amphora,
  });
};

/**
 * Hydrate multiple MongoDB documents into typed entity instances.
 */
export const hydrateEntities = <E extends IEntity>(
  docs: Array<Document>,
  metadata: EntityMetadata,
  amphora?: IAmphora,
  snapshot?: boolean,
): Array<E> => {
  return docs.map((doc) => hydrateEntity<E>(doc, metadata, amphora, snapshot));
};
