import type { EntityMetadata } from "#internal/entity/types/metadata";
import type { DesiredMongoIndex } from "./types";
import { hashIdentifier } from "#internal/utils/sql/hash-identifier";

/**
 * Resolve the MongoDB collection name for an entity.
 * Namespace maps to database name (A07), not collection prefix.
 */
const resolveCollectionName = (metadata: EntityMetadata): string => {
  return metadata.entity.name;
};

/**
 * Resolve the MongoDB field name for a given entity field key.
 * For single-PK entities, the primary key maps to _id.
 */
const resolveMongoFieldName = (fieldKey: string, metadata: EntityMetadata): string => {
  if (metadata.primaryKeys.length === 1 && fieldKey === metadata.primaryKeys[0]) {
    return "_id";
  }
  const field = metadata.fields.find((f) => f.key === fieldKey);
  return field?.name ?? fieldKey;
};

/**
 * Project desired MongoDB indexes from entity metadata.
 *
 * Produces index entries for:
 * - @Index decorator indexes
 * - @Unique decorator → unique indexes
 * - FK indexes from owning relations (compound for compound FKs)
 * - TTL indexes from @ExpiryDateField
 * - Discriminator index for single-table inheritance parent entities
 */
export const projectDesiredIndexes = (
  metadataList: Array<EntityMetadata>,
  _namespace: string | null,
): Array<DesiredMongoIndex> => {
  const result: Array<DesiredMongoIndex> = [];
  const seenCollections = new Set<string>();

  for (const metadata of metadataList) {
    const collectionName = resolveCollectionName(metadata);

    // For single-table inheritance children, indexes belong to the root's collection.
    // Skip child entities — the root entity's metadata already includes all needed indexes.
    // NOTE: child-specific @Index decorators are silently ignored here.
    if (metadata.inheritance?.discriminatorValue != null) {
      continue;
    }

    if (seenCollections.has(collectionName)) continue;
    seenCollections.add(collectionName);

    // @Index decorator indexes
    for (const index of metadata.indexes) {
      const validKeys = index.keys.filter(
        (k) => k.direction === "asc" || k.direction === "desc",
      );
      if (validKeys.length === 0) continue;

      const mongoKeys: Record<string, 1 | -1> = {};
      const keyNames: Array<string> = [];

      for (const k of validKeys) {
        const mongoName = resolveMongoFieldName(k.key, metadata);
        mongoKeys[mongoName] = k.direction === "desc" ? -1 : 1;
        keyNames.push(mongoName);
      }

      const autoName = `proteus_idx_${hashIdentifier(`${collectionName}_${keyNames.join("_")}`)}`;
      const name = index.name ? `proteus_idx_${index.name}` : autoName;

      result.push({
        collection: collectionName,
        name,
        keys: mongoKeys,
        unique: index.unique,
        sparse: index.sparse,
        expireAfterSeconds: null,
      });
    }

    // @Unique decorator → unique indexes
    for (const unique of metadata.uniques) {
      const mongoKeys: Record<string, 1 | -1> = {};
      const keyNames: Array<string> = [];

      for (const key of unique.keys) {
        const mongoName = resolveMongoFieldName(key, metadata);
        mongoKeys[mongoName] = 1;
        keyNames.push(mongoName);
      }

      const autoName = `proteus_uniq_${hashIdentifier(`${collectionName}_${keyNames.join("_")}`)}`;
      const name = unique.name ? `proteus_uniq_${unique.name}` : autoName;

      result.push({
        collection: collectionName,
        name,
        keys: mongoKeys,
        unique: true,
        sparse: false,
        expireAfterSeconds: null,
      });
    }

    // FK indexes from owning relations (compound for compound FKs)
    for (const relation of metadata.relations) {
      if (!relation.joinKeys) continue;
      if (relation.type === "ManyToMany") continue;

      const mongoKeys: Record<string, 1 | -1> = {};
      const keyNames: Array<string> = [];

      for (const localKey of Object.keys(relation.joinKeys)) {
        const mongoName = resolveMongoFieldName(localKey, metadata);
        mongoKeys[mongoName] = 1;
        keyNames.push(mongoName);
      }

      const autoName = `proteus_idx_${hashIdentifier(`${collectionName}_fk_${keyNames.join("_")}`)}`;

      // Don't add if an identical-keys index already exists
      const alreadyExists = result.some(
        (r) =>
          r.collection === collectionName &&
          JSON.stringify(r.keys) === JSON.stringify(mongoKeys),
      );
      if (alreadyExists) continue;

      result.push({
        collection: collectionName,
        name: autoName,
        keys: mongoKeys,
        unique: false,
        sparse: false,
        expireAfterSeconds: null,
      });
    }

    // TTL index from @ExpiryDate field
    const expiryField = metadata.fields.find((f) => f.decorator === "ExpiryDate");
    if (expiryField) {
      const mongoKey = resolveMongoFieldName(expiryField.key, metadata);
      const ttlName = `proteus_ttl_${hashIdentifier(`${collectionName}_${mongoKey}`)}`;

      result.push({
        collection: collectionName,
        name: ttlName,
        keys: { [mongoKey]: 1 },
        unique: false,
        sparse: false,
        expireAfterSeconds: 0, // MongoDB TTL with expireAfterSeconds=0 uses the field value as the expiry time
      });
    }

    // Discriminator index for single-table inheritance parent entities
    if (
      metadata.inheritance &&
      metadata.inheritance.discriminatorValue == null &&
      metadata.inheritance.children.size > 0
    ) {
      const discrimField = metadata.inheritance.discriminatorField;
      const discrimIdxName = `proteus_idx_${hashIdentifier(`${collectionName}_${discrimField}`)}`;

      // Only add if no user-defined index already covers this column
      const alreadyCovered = result.some(
        (r) =>
          r.collection === collectionName &&
          Object.keys(r.keys).length === 1 &&
          discrimField in r.keys,
      );

      if (!alreadyCovered) {
        result.push({
          collection: collectionName,
          name: discrimIdxName,
          keys: { [discrimField]: 1 },
          unique: false,
          sparse: false,
          expireAfterSeconds: null,
        });
      }
    }

    // ManyToMany join collection indexes
    for (const relation of metadata.relations) {
      if (relation.type !== "ManyToMany") continue;
      if (typeof relation.joinTable !== "string") continue;
      if (!relation.joinKeys) continue;

      const joinCollName = relation.joinTable;
      if (seenCollections.has(joinCollName)) continue;
      seenCollections.add(joinCollName);

      // Compound unique index on all join key columns
      const mongoKeys: Record<string, 1 | -1> = {};
      const keyNames: Array<string> = [];

      for (const localKey of Object.keys(relation.joinKeys)) {
        mongoKeys[localKey] = 1;
        keyNames.push(localKey);
      }

      // Also add the foreign side keys if available
      const foreignMeta = metadataList.find(
        (m) => m.target === relation.foreignConstructor(),
      );
      if (foreignMeta) {
        const inverseRelation = foreignMeta.relations.find(
          (r) =>
            r.foreignKey === relation.key &&
            r.key === relation.foreignKey &&
            r.type === "ManyToMany",
        );
        if (inverseRelation?.joinKeys) {
          for (const localKey of Object.keys(inverseRelation.joinKeys)) {
            if (!(localKey in mongoKeys)) {
              mongoKeys[localKey] = 1;
              keyNames.push(localKey);
            }
          }
        }
      }

      const indexName = `proteus_uniq_${hashIdentifier(`${joinCollName}_${keyNames.join("_")}`)}`;
      result.push({
        collection: joinCollName,
        name: indexName,
        keys: mongoKeys,
        unique: true,
        sparse: false,
        expireAfterSeconds: null,
      });
    }
  }

  return result;
};
