import type { Constructor, Dict } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { getEntityName } from "../../../entity/utils/get-entity-name.js";
import { encodePkSegment } from "./encode-pk-segment.js";

/**
 * Build a Redis key from namespace, entity name, and PK values.
 *
 * Pattern: `{ns}:{entity}:{pk1}:{pk2}` or `{entity}:{pk1}` when no namespace.
 */
export const buildEntityKey = <E extends IEntity>(
  target: Constructor<E>,
  pkValues: Array<unknown>,
  namespace: string | null,
): string => {
  const scoped = getEntityName(target, { namespace });
  const segments = scoped.parts.map(encodePkSegment);

  for (const pk of pkValues) {
    segments.push(encodePkSegment(pk));
  }

  return segments.join(":");
};

/**
 * Build a Redis key from a row Dict by extracting PK values in metadata order.
 */
export const buildEntityKeyFromRow = <E extends IEntity>(
  target: Constructor<E>,
  row: Dict,
  metadata: EntityMetadata,
  namespace: string | null,
): string => {
  const pkValues = metadata.primaryKeys.map((pk) => row[pk]);
  return buildEntityKey(target, pkValues, namespace);
};
