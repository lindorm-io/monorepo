import { isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import type { OrderValue } from "../../../types/find-options.js";
import { NotSupportedError } from "../../../errors/index.js";

/**
 * Sort rows by one or more field keys with ASC/DESC direction.
 *
 * - Null values sort last for ASC, first for DESC.
 * - Comparison uses `<` / `>` operators, which works for strings, numbers, and Dates.
 * - Stable within equal-comparison groups by falling through to the next sort key.
 *
 * Used by Memory and Redis drivers for client-side ordering.
 */
export const applyOrdering = <E extends IEntity>(
  rows: Array<Dict>,
  order: Partial<Record<keyof E, OrderValue>> | null | undefined,
): Array<Dict> => {
  if (!order) return rows;

  const entries = Object.entries(order) as Array<[string, OrderValue]>;
  if (entries.length === 0) return rows;

  for (const [, value] of entries) {
    if (isObject<{ $similarity: string }>(value)) {
      throw new NotSupportedError(
        "Ordering by trigram $similarity is only supported by the PostgreSQL driver",
        {
          code: "unsupported_operation",
          title: "Unsupported Operation",
          details:
            "Relevance ordering via $similarity relies on PostgreSQL's pg_trgm extension and is not available on in-memory or Redis drivers.",
          data: { operator: "$similarity" },
        },
      );
    }
  }

  return [...rows].sort((a, b) => {
    for (const [key, direction] of entries) {
      const aVal = a[key];
      const bVal = b[key];

      if (aVal === bVal) continue;
      if (aVal == null) return direction === "ASC" ? 1 : -1;
      if (bVal == null) return direction === "ASC" ? -1 : 1;

      const cmp = aVal < bVal ? -1 : 1;
      return direction === "ASC" ? cmp : -cmp;
    }
    return 0;
  });
};
