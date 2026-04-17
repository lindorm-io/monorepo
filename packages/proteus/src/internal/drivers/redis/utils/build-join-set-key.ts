import { getJoinName } from "../../../entity/utils/get-join-name";
import { encodePkSegment } from "./encode-pk-segment";

/**
 * Build a forward M2M join SET key.
 *
 * Pattern: `{ns}:{join}:{joinName}:{joinCol}:{value}`
 * or `{join}:{joinName}:{joinCol}:{value}` when no namespace.
 */
export const buildJoinSetKey = (
  joinTable: string,
  joinCol: string,
  value: unknown,
  namespace: string | null,
): string => {
  const scoped = getJoinName(joinTable, { namespace });
  const segments = scoped.parts.map(encodePkSegment);
  segments.push(encodePkSegment(joinCol));
  segments.push(encodePkSegment(value));
  return segments.join(":");
};

/**
 * Build a reverse M2M join SET key (for inverse-side loading).
 *
 * Pattern: `{ns}:{join}:{joinName}:rev:{joinCol}:{value}`
 * or `{join}:{joinName}:rev:{joinCol}:{value}` when no namespace.
 */
export const buildReverseJoinSetKey = (
  joinTable: string,
  joinCol: string,
  value: unknown,
  namespace: string | null,
): string => {
  const scoped = getJoinName(joinTable, { namespace });
  const segments = scoped.parts.map(encodePkSegment);
  segments.push("rev");
  segments.push(encodePkSegment(joinCol));
  segments.push(encodePkSegment(value));
  return segments.join(":");
};
