import { Constructor } from "@lindorm/types";
import { VersionManager } from "../classes/VersionManager";
import { IEntity } from "../interfaces";
import { globalEntityMetadata } from "./global";

/**
 * Prepares an entity for update operation.
 * - Updates updateDate timestamp
 * - Increments version number
 *
 * @param target - Entity constructor
 * @param entity - Entity to update (mutated in place)
 * @returns The updated entity
 */
export const defaultUpdateEntity = <E extends IEntity>(
  target: Constructor<E>,
  entity: E,
): E => {
  const metadata = globalEntityMetadata.get(target);

  const updateDate = metadata.columns.find((c) => c.decorator === "UpdateDateColumn");

  if (updateDate) {
    (entity as any)[updateDate.key] = new Date();
  }

  // Use VersionManager for version handling
  const versionManager = new VersionManager<E>(metadata);
  versionManager.prepareForUpdate(entity);

  return entity;
};
