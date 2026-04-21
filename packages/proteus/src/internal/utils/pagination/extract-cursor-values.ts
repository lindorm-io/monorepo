import type { IEntity } from "../../../interfaces/index.js";
import type { KeysetOrderEntry } from "./build-keyset-order.js";

/**
 * Extract cursor column values from an entity, aligned with keyset order entries.
 *
 * Returns an array of values in the same order as the entries, suitable for
 * passing to encodeCursor().
 *
 * Date values are serialized as ISO strings to survive JSON round-trips.
 */
export const extractCursorValues = <E extends IEntity>(
  entity: E,
  entries: Array<KeysetOrderEntry>,
): Array<unknown> => {
  return entries.map(({ column }) => {
    const value = (entity as Record<string, unknown>)[column];

    // Serialize Dates to ISO strings for JSON safety
    if (value instanceof Date) {
      return value.toISOString();
    }

    return value ?? null;
  });
};
