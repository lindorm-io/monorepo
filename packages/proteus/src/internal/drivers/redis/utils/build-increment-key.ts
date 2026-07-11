import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { getEntityName } from "../../../entity/utils/get-entity-name.js";
import { encodePkSegment } from "./encode-pk-segment.js";

/**
 * Build the Redis key for an auto-increment counter.
 *
 * Pattern: `{ns:}seq:{name}:{field}`
 * e.g. `myns:seq:user:id` or `seq:user:id` without namespace.
 *
 * Takes the resolved metadata so the entity segment follows the source's naming
 * strategy.
 */
export const buildIncrementKey = (
  metadata: EntityMetadata,
  fieldName: string,
  namespace: string | null,
): string => {
  const scoped = getEntityName(metadata, { namespace });
  const segments: Array<string> = [];

  if (scoped.namespace) {
    segments.push(scoped.namespace);
  }

  segments.push("seq", encodePkSegment(scoped.name), encodePkSegment(fieldName));

  return segments.join(":");
};
