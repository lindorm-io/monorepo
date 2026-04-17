import type { ILogger } from "@lindorm/logger";
import type { EntityMetadata } from "../../../entity/types/metadata";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata";
import { NotSupportedError } from "../../../../errors/NotSupportedError";
import { RedisDriverError } from "../errors/RedisDriverError";

/**
 * Validates that an entity's metadata is compatible with the Redis driver.
 * Called during setup() for each registered entity. Throws on incompatible
 * features, warns on risky configurations.
 */
export const validateRedisEntity = (metadata: EntityMetadata, logger: ILogger): void => {
  const entityName = metadata.entity.name;

  // === Unsupported features -- always THROW ===

  // Joined inheritance is not supported (Redis has no relational JOIN capability)
  if (metadata.inheritance?.strategy === "joined") {
    throw new NotSupportedError(
      `Redis driver does not support joined inheritance (entity: "${entityName}"). Use single-table instead.`,
    );
  }

  // @EmbeddedList is not supported (Redis has no collection tables)
  if (metadata.embeddedLists.length > 0) {
    throw new NotSupportedError(
      `Redis driver does not support @EmbeddedList (entity: "${entityName}")`,
    );
  }

  // NOTE: @Index / auto-indexes are silently ignored for Redis — they are
  // SQL-specific hints that have no equivalent in Redis. We do NOT throw here
  // because auto-indexes are generated for entities with @VersionField etc.,
  // and excluding them would break single-table inheritance (root entity
  // must be registered for child entities to resolve).

  // @Unique is not supported (Redis has no unique constraints)
  if (metadata.uniques.length > 0) {
    throw new NotSupportedError(
      `Redis driver does not support @Unique (entity: "${entityName}")`,
    );
  }

  // @Check is not supported (Redis has no check constraints)
  if (metadata.checks.length > 0) {
    throw new NotSupportedError(
      `Redis driver does not support @Check (entity: "${entityName}")`,
    );
  }

  // @Computed is not supported (Redis has no computed columns)
  if (metadata.fields.some((f) => f.computed != null)) {
    throw new NotSupportedError(
      `Redis driver does not support @Computed (entity: "${entityName}")`,
    );
  }

  // @VersionStartDate / @VersionEndDate are not supported (Redis has no temporal versioning)
  const versionKeyDecorators = ["VersionStartDate", "VersionEndDate"];
  if (metadata.fields.some((f) => versionKeyDecorators.includes(f.decorator))) {
    throw new NotSupportedError(
      `Redis driver does not support versioning (@VersionKey family) (entity: "${entityName}")`,
    );
  }

  // ManyToMany targeting an entity with composite PK is not supported
  // (Redis SET members are single-value; composite PK loading uses only the first PK)
  for (const relation of metadata.relations) {
    if (relation.type !== "ManyToMany") continue;

    const foreignTarget = relation.foreignConstructor();
    const foreignMeta = getEntityMetadata(foreignTarget);
    if (foreignMeta.primaryKeys.length > 1) {
      throw new NotSupportedError(
        `Redis driver does not support @ManyToMany targeting an entity with composite primary key (entity: "${entityName}", relation: "${relation.key}", target: "${foreignMeta.entity.name}")`,
      );
    }
  }

  // === Expiry conflict rules ===

  const hasExpiryDate = metadata.fields.some((f) => f.decorator === "ExpiryDate");
  const hasDeleteDate = metadata.fields.some((f) => f.decorator === "DeleteDate");

  // ExpiryDate + DeleteDate is contradictory in Redis (TTL vs soft-delete)
  if (hasExpiryDate && hasDeleteDate) {
    throw new RedisDriverError(
      `Redis driver does not support expiry combined with soft-delete (entity: "${entityName}")`,
    );
  }

  // ExpiryDate + ManyToMany owning side is dangerous (TTL deletes key but join SETs remain)
  if (hasExpiryDate) {
    for (const relation of metadata.relations) {
      if (relation.type === "ManyToMany" && relation.joinKeys) {
        throw new RedisDriverError(
          `Redis driver does not support expiry on entities that own a ManyToMany relation (entity: "${entityName}", relation: "${relation.key}")`,
        );
      }

      // Only warn for OneToMany and inverse OneToOne (no joinKeys = inverse side)
      // ManyToOne is safe: the FK is on the expiring entity, not the related entity
      if (
        relation.type === "OneToMany" ||
        (relation.type === "OneToOne" && !relation.joinKeys)
      ) {
        logger.warn(
          `Entity "${entityName}" has expiry and relation "${relation.key}" -- expiry may cause orphaned references`,
        );
      }
    }
  }
};

/**
 * Returns true if the entity metadata is compatible with the Redis driver.
 * Used by the TCK harness to filter entities before setup -- mirrors the
 * throw conditions in validateRedisEntity without actually throwing.
 */
export const isRedisCompatibleEntity = (metadata: EntityMetadata): boolean => {
  if (metadata.inheritance?.strategy === "joined") return false;
  if (metadata.embeddedLists.length > 0) return false;
  // NOTE: indexes are silently ignored for Redis — do NOT filter them out
  // because auto-indexes are generated for entities with @VersionField etc.,
  // and excluding them breaks single-table inheritance (root must be registered).
  if (metadata.uniques.length > 0) return false;
  if (metadata.checks.length > 0) return false;
  if (metadata.fields.some((f) => f.computed != null)) return false;

  const versionKeyDecorators = ["VersionStartDate", "VersionEndDate"];
  if (metadata.fields.some((f) => versionKeyDecorators.includes(f.decorator)))
    return false;

  for (const relation of metadata.relations) {
    if (relation.type !== "ManyToMany") continue;
    try {
      const foreignMeta = getEntityMetadata(relation.foreignConstructor());
      if (foreignMeta.primaryKeys.length > 1) return false;
    } catch {
      // If foreign metadata cannot be resolved, skip this check
    }
  }

  const hasExpiryDate = metadata.fields.some((f) => f.decorator === "ExpiryDate");
  const hasDeleteDate = metadata.fields.some((f) => f.decorator === "DeleteDate");

  if (hasExpiryDate && hasDeleteDate) return false;

  if (hasExpiryDate) {
    for (const relation of metadata.relations) {
      if (relation.type === "ManyToMany" && relation.joinKeys) return false;
    }
  }

  return true;
};
