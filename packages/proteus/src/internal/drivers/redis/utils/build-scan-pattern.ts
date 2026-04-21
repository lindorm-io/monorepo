import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces/index.js";
import { getEntityName } from "../../../entity/utils/get-entity-name.js";
import { encodePkSegment } from "./encode-pk-segment.js";

/**
 * Build a SCAN MATCH pattern for all keys of a given entity.
 *
 * Pattern: `{ns}:{type}:{entity}:*` or `{type}:{entity}:*` when no namespace.
 */
export const buildScanPattern = <E extends IEntity>(
  target: Constructor<E>,
  namespace: string | null,
): string => {
  const scoped = getEntityName(target, { namespace });
  const segments = scoped.parts.map(encodePkSegment);
  segments.push("*");
  return segments.join(":");
};
