import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata } from "../types/metadata.js";

/**
 * For table inheritance (single-table or joined), resolves the root entity's constructor.
 *
 * If the entity participates in an inheritance hierarchy and has a root
 * (i.e., it is a child entity), the root constructor is returned. Otherwise,
 * the original target is returned unchanged.
 *
 * Used by Memory and Redis drivers to ensure all types in an inheritance
 * hierarchy share the same storage collection / key prefix. The Memory driver
 * flattens "joined" to single-table storage internally — no multi-store
 * simulation is needed.
 */
export const resolveInheritanceRoot = <E extends IEntity>(
  target: Constructor<E>,
  metadata: EntityMetadata,
): Constructor<IEntity> => {
  if (metadata.inheritance && metadata.inheritance.discriminatorValue != null) {
    return metadata.inheritance.root;
  }

  return target;
};
