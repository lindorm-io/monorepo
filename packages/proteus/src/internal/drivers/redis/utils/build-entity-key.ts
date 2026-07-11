import type { Dict } from "@lindorm/types";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { getEntityName } from "../../../entity/utils/get-entity-name.js";
import { encodePkSegment } from "./encode-pk-segment.js";

/**
 * Build a Redis key from namespace, entity name, and PK values.
 *
 * Pattern: `{ns}:{entity}:{pk1}:{pk2}` or `{entity}:{pk1}` when no namespace.
 *
 * Takes the resolved storage metadata so the entity segment follows the source's
 * naming strategy (see `resolveStorageMetadata`).
 */
export const buildEntityKey = (
  metadata: EntityMetadata,
  pkValues: Array<unknown>,
  namespace: string | null,
): string => {
  const scoped = getEntityName(metadata, { namespace });
  const segments = scoped.parts.map(encodePkSegment);

  for (const pk of pkValues) {
    segments.push(encodePkSegment(pk));
  }

  return segments.join(":");
};

/**
 * Build a Redis key from a row Dict by extracting PK values in metadata order.
 *
 * `storageMetadata` names the key (naming-resolved storage root); `metadata`
 * supplies the primary-key order for extracting values from the row.
 */
export const buildEntityKeyFromRow = (
  storageMetadata: EntityMetadata,
  row: Dict,
  metadata: EntityMetadata,
  namespace: string | null,
): string => {
  const pkValues = metadata.primaryKeys.map((pk) => row[pk]);
  return buildEntityKey(storageMetadata, pkValues, namespace);
};
