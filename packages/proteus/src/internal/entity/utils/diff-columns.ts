import { isObjectLike } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { IEntity } from "../../../interfaces";
import type { EntityMetadata } from "../types/metadata";
import { resolveJoinKeyValue } from "./resolve-join-key-value";

/**
 * Compare current entity field values against a snapshot and return only
 * the changed columns (keyed by column name).
 *
 * Returns `null` if zero columns differ — callers check `=== null`.
 * Never returns `{}`.
 *
 * Note: @EmbeddedList fields are NOT tracked here — they live in separate
 * collection tables and are saved via full-replacement (DELETE + INSERT).
 * Mutations to an entity's embedded lists alone will NOT trigger a version
 * bump or UpdateDate change. If you need the parent row to reflect list
 * changes, also mutate a tracked field on the parent entity.
 *
 * Exclusions (pipeline-managed fields):
 * - PKs, CreateDate, generated increments, readonly user fields
 * - Version, UpdateDate, VersionStartDate, VersionEndDate
 *   (always bumped by the update pipeline — excluded to prevent false positives)
 */
export const diffColumns = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  snapshot: Dict,
): Dict | null => {
  const changed: Dict = {};
  const excludeKeys = getExcludeKeys(metadata);
  let count = 0;

  for (const field of metadata.fields) {
    if (excludeKeys.has(field.key)) continue;

    let current: unknown;
    let previous: unknown;

    if (field.embedded) {
      // Embedded fields use dotted keys (e.g., "address.street") but after
      // hydration the entity has nested objects: entity.address.street
      // and the snapshot stores snapshot["address"] = { street: ... }.
      // Normalize undefined → null so SQL params never receive undefined.
      const parentObj = (entity as any)[field.embedded.parentKey];
      const nestedKey = field.key.split(".")[1];
      current = parentObj != null ? parentObj[nestedKey] : null;
      const prevParent = snapshot[field.embedded.parentKey];
      previous = prevParent != null ? prevParent[nestedKey] : null;
    } else {
      current = (entity as any)[field.key];
      previous = snapshot[field.key];
    }

    if (!valuesEqual(current, previous)) {
      changed[field.name] = current;
      count++;
    }
  }

  // Include FK columns from owning relations
  for (const relation of metadata.relations) {
    if (!relation.joinKeys || relation.type === "ManyToMany") continue;

    for (const [localKey, foreignKey] of Object.entries(relation.joinKeys)) {
      if (excludeKeys.has(localKey)) continue;

      const current = resolveJoinKeyValue(entity, relation, localKey, foreignKey);
      const previous = snapshot[localKey];

      if (!valuesEqual(current, previous)) {
        changed[localKey] = current;
        count++;
      }
    }
  }

  return count > 0 ? changed : null;
};

const getExcludeKeys = (metadata: EntityMetadata): Set<string> => {
  const exclude = new Set<string>();

  for (const pk of metadata.primaryKeys) {
    exclude.add(pk);
  }

  for (const gen of metadata.generated) {
    if (gen.strategy === "increment" || gen.strategy === "identity") {
      exclude.add(gen.key);
    }
  }

  for (const field of metadata.fields) {
    switch (field.decorator) {
      case "CreateDate":
      case "Version":
      case "UpdateDate":
      case "VersionStartDate":
      case "VersionEndDate":
        exclude.add(field.key);
        break;

      case "Field":
        if (field.readonly) exclude.add(field.key);
        if (field.computed) exclude.add(field.key);
        break;
    }
  }

  // Virtual computed properties — never diffed
  for (const ri of metadata.relationIds ?? []) {
    exclude.add(ri.key);
  }
  for (const rc of metadata.relationCounts ?? []) {
    exclude.add(rc.key);
  }

  return exclude;
};

const valuesEqual = (a: unknown, b: unknown): boolean => {
  // null and undefined are equivalent (both mean "no value")
  if ((a === null || a === undefined) && (b === null || b === undefined)) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;

  // Date comparison by timestamp
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date || b instanceof Date) return false;

  // Buffer comparison
  if (Buffer.isBuffer(a) && Buffer.isBuffer(b)) return a.equals(b);
  if (Buffer.isBuffer(a) || Buffer.isBuffer(b)) return false;

  // BigInt comparison
  if (typeof a === "bigint" && typeof b === "bigint") return a === b;
  if (typeof a === "bigint" || typeof b === "bigint") return false;

  // Array deep equality (order-sensitive)
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!valuesEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (Array.isArray(a) || Array.isArray(b)) return false;

  // Object deep equality (key-order-insensitive)
  if (isObjectLike(a) && isObjectLike(b)) {
    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!valuesEqual((a as any)[key], (b as any)[key])) return false;
    }
    return true;
  }

  // Primitive strict equality
  return a === b;
};
