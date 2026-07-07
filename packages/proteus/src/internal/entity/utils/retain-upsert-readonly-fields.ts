import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata } from "../types/metadata.js";

/**
 * On an upsert conflict, keep the existing row's value for user fields marked
 * read-only on `"upsert"` (`@ReadOnly("upsert")` / `@ReadOnly()`) — including the
 * immutable `@CreateDateField` — but NOT the framework-managed Version /
 * UpdateDate, which the conflict update re-derives (bumped / re-stamped).
 *
 * SQL drivers express this declaratively by dropping the column from the
 * conflict `DO UPDATE SET` (see `getUpsertSetSkipColumns`). The memory driver
 * merges against the existing row, so it preserves these fields via the
 * `"upsert"` operation scope passed to `executeUpdate`.
 *
 * The redis executor overwrites the whole hash wholesale (no per-field merge),
 * so the repository must pre-merge the retained values with this helper before
 * the update lands — making the write a no-op for those columns.
 *
 * `existing` is keyed by field property key (`field.key`), matching a hydrated
 * redis entity.
 */
export const retainUpsertReadonlyFields = <E extends IEntity>(
  prepared: E,
  existing: Record<string, unknown>,
  metadata: EntityMetadata,
): void => {
  for (const field of metadata.fields) {
    if (!field.readonly.includes("upsert")) continue;

    // Version and UpdateDate carry readonly on both operations, but the conflict
    // update re-derives them (Version is incremented, UpdateDate is re-stamped),
    // so they must NOT be preserved — that would freeze the version and updatedAt.
    // This mirrors the SQL chokepoint, which keeps them out of the skip set.
    if (field.decorator === "Version" || field.decorator === "UpdateDate") continue;

    if (field.key in existing) {
      (prepared as any)[field.key] = existing[field.key];
    }
  }
};
