import type { Predicate } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import type { FindOptions } from "../../../types/index.js";
import type { PaginateOptions } from "../../../types/paginate-options.js";
import type { KeysetOrderEntry } from "./build-keyset-order.js";
import type { QueryScope } from "../../entity/types/metadata.js";
import { buildKeysetFilterMemory } from "./build-keyset-filter-memory.js";

/**
 * Callback matching the `find` method signature on Memory/Redis repositories.
 */
export type InMemoryFindFn<E extends IEntity> = (
  criteria?: Predicate<E>,
  options?: FindOptions<E>,
  scope?: QueryScope,
) => Promise<Array<E>>;

/**
 * Shared in-memory keyset pagination logic used by both the Memory and Redis
 * drivers. These drivers cannot use Predicate-based keyset WHERE ($gt/$lt)
 * because their executors use Predicated.match, which does not support
 * comparison operators on string types.
 *
 * Instead, when a cursor is present we fetch all matching rows with ordering,
 * apply `buildKeysetFilterMemory()` client-side, then slice to the limit.
 *
 * @param find           The driver's find method (bound to the repository instance)
 * @param criteria       WHERE predicate from the paginate call
 * @param keysetEntries  Ordered keyset columns + directions
 * @param cursorValues   Decoded cursor values, or null for the first page
 * @param isBackward     True for backward (last/before) pagination
 * @param effectiveOrderBy  The resolved ORDER BY record
 * @param limit          Page size
 * @param options        Original PaginateOptions (withDeleted, relations, filters)
 */
export const executePaginateFindInMemory = async <E extends IEntity>(
  find: InMemoryFindFn<E>,
  criteria: Predicate<E>,
  keysetEntries: Array<KeysetOrderEntry>,
  cursorValues: Array<unknown> | null,
  isBackward: boolean,
  effectiveOrderBy: Partial<Record<keyof E, "ASC" | "DESC">>,
  limit: number,
  options: PaginateOptions<E>,
): Promise<Array<E>> => {
  if (!cursorValues) {
    // No cursor -- just a normal find with ordering and limit
    return find(
      criteria,
      {
        order: effectiveOrderBy,
        limit,
        withDeleted: options.withDeleted,
        relations: options.relations,
        filters: options.filters,
        snapshot: options.snapshot,
      } as FindOptions<E>,
      "multiple",
    );
  }

  // Fetch all matching rows (no keyset filter yet), ordered correctly
  const allRows = await find(
    Object.keys(criteria).length > 0 ? criteria : undefined,
    {
      order: effectiveOrderBy,
      withDeleted: options.withDeleted,
      relations: options.relations,
      filters: options.filters,
      snapshot: options.snapshot,
    } as FindOptions<E>,
    "multiple",
  );

  // Apply in-memory keyset filter
  const keysetFilter = buildKeysetFilterMemory(keysetEntries, cursorValues, isBackward);
  const filtered = allRows.filter((entity) =>
    keysetFilter(entity as unknown as Record<string, unknown>),
  );

  // Apply limit
  return filtered.slice(0, limit);
};
