import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces/index.js";
import { getEntityName } from "../../../entity/utils/get-entity-name.js";
import { encodePkSegment } from "./encode-pk-segment.js";

/**
 * Build the Redis key for an auto-increment counter.
 *
 * Pattern: `{ns:}seq:{name}:{field}`
 * e.g. `myns:seq:user:id` or `seq:user:id` without namespace.
 */
export const buildIncrementKey = <E extends IEntity>(
  target: Constructor<E>,
  fieldName: string,
  namespace: string | null,
): string => {
  const scoped = getEntityName(target, { namespace });
  const segments: Array<string> = [];

  if (scoped.namespace) {
    segments.push(scoped.namespace);
  }

  segments.push("seq", encodePkSegment(scoped.name), encodePkSegment(fieldName));

  return segments.join(":");
};
