import type { IEntity } from "../../../interfaces";
import type { EntityMetadata } from "#internal/entity/types/metadata";

export type KeysetOrderEntry = {
  /** Property key on the entity (e.g. "createdAt") */
  column: string;
  /** Sort direction */
  direction: "ASC" | "DESC";
};

/**
 * Normalize the user-provided orderBy into an ordered list of entries,
 * auto-appending primary key column(s) as a deterministic tiebreaker
 * if they are not already included.
 *
 * Without PK tiebreaker, rows with identical sort values produce
 * non-deterministic ordering and broken cursor pagination.
 */
export const buildKeysetOrder = <E extends IEntity>(
  orderBy: Partial<Record<keyof E, "ASC" | "DESC">>,
  metadata: EntityMetadata,
): Array<KeysetOrderEntry> => {
  const entries: Array<KeysetOrderEntry> = [];
  const included = new Set<string>();

  for (const [column, direction] of Object.entries(orderBy)) {
    if (!direction) continue;
    entries.push({ column, direction });
    included.add(column);
  }

  // Auto-append primary key columns as tiebreaker (F6)
  for (const pk of metadata.primaryKeys) {
    if (!included.has(pk)) {
      entries.push({ column: pk, direction: "ASC" });
    }
  }

  return entries;
};

/**
 * Convert keyset order entries back to an orderBy record,
 * optionally flipping all directions (for backward pagination).
 */
export const keysetOrderToRecord = <E extends IEntity>(
  entries: Array<KeysetOrderEntry>,
  flip = false,
): Partial<Record<keyof E, "ASC" | "DESC">> => {
  const record: Partial<Record<keyof E, "ASC" | "DESC">> = {};

  for (const { column, direction } of entries) {
    const dir = flip ? (direction === "ASC" ? "DESC" : "ASC") : direction;
    (record as Record<string, "ASC" | "DESC">)[column] = dir;
  }

  return record;
};
