import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata, ReadOnlyOperation } from "../types/metadata.js";

/**
 * Keep the existing row's value for user fields marked read-only on the given
 * `operation` — `@ReadOnly()` covers both `"update"` and `"upsert"`, while
 * `@ReadOnly("update")` / `@ReadOnly("upsert")` scope to one — including the
 * immutable `@CreateDateField` (readonly on both), but NOT the framework-managed
 * Version / UpdateDate, which the write re-derives (Version is bumped, UpdateDate
 * is re-stamped).
 *
 * SQL drivers express this declaratively by dropping the column from the write
 * (UPDATE column list / conflict `DO UPDATE SET`). The memory driver merges
 * against the existing row via the same `operation` scope in `executeUpdate`.
 *
 * The redis / mongo executors overwrite the whole hash / document wholesale (no
 * per-field merge), so the repository must pre-merge the retained values with
 * this helper before the write lands — making it a no-op for those columns. The
 * `"upsert"` scope is used on the upsert-conflict path; the `"update"` scope on
 * the `update()` / `save()` update branch.
 *
 * `existing` is keyed by field property key (`field.key`), matching a hydrated
 * redis / mongo entity.
 */
export const retainReadonlyFields = <E extends IEntity>(
  prepared: E,
  existing: Record<string, unknown>,
  metadata: EntityMetadata,
  operation: ReadOnlyOperation,
): void => {
  for (const field of metadata.fields) {
    if (!field.readonly.includes(operation)) continue;

    // Version and UpdateDate carry readonly on both operations, but the write
    // re-derives them (Version is incremented, UpdateDate is re-stamped), so
    // they must NOT be preserved — that would freeze the version and updatedAt.
    // This mirrors the SQL chokepoint, which keeps them out of the skip set.
    if (field.decorator === "Version" || field.decorator === "UpdateDate") continue;

    if (field.key in existing) {
      (prepared as any)[field.key] = existing[field.key];
    }
  }
};
