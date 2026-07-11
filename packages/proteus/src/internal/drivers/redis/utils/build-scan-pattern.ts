import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { getEntityName } from "../../../entity/utils/get-entity-name.js";
import { encodePkSegment } from "./encode-pk-segment.js";

/**
 * Build a SCAN MATCH pattern for all keys of a given entity.
 *
 * Pattern: `{ns}:{type}:{entity}:*` or `{type}:{entity}:*` when no namespace.
 *
 * Takes the resolved storage metadata so the entity segment follows the source's
 * naming strategy.
 */
export const buildScanPattern = (
  metadata: EntityMetadata,
  namespace: string | null,
): string => {
  const scoped = getEntityName(metadata, { namespace });
  const segments = scoped.parts.map(encodePkSegment);
  segments.push("*");
  return segments.join(":");
};
