import type { Dict, Predicate } from "@lindorm/types";
import type { ResolvedFilter } from "./resolve-filters.js";
import { Predicated } from "@lindorm/utils";

/**
 * Test whether a single row matches a predicate criteria.
 */
export const matchesRow = (row: Dict, criteria: Predicate<any>): boolean =>
  Predicated.match(row as Record<string, unknown>, criteria);

/**
 * Project a row down to the selected field keys.
 * Returns the original row unchanged when selections is null or empty.
 */
export const applySelect = (row: Dict, selections: Array<string> | null): Dict => {
  if (!selections || selections.length === 0) return row;
  const result: Dict = {};
  for (const key of selections) {
    if (key in row) result[key] = row[key];
  }
  return result;
};

/**
 * Apply resolved filter predicates to rows using Predicated.filter.
 */
export const applyResolvedFilters = (
  rows: Array<Dict>,
  filters: Array<ResolvedFilter>,
): Array<Dict> => {
  for (const filter of filters) {
    rows = Predicated.filter(rows as Array<Record<string, unknown>>, filter.predicate);
  }
  return rows;
};

/**
 * Apply offset/limit pagination to a row array.
 */
export const applyPagination = <T>(
  rows: Array<T>,
  options: {
    offset?: number | null;
    limit?: number | null;
  },
): Array<T> => {
  const offset = options.offset ?? 0;
  const limit = options.limit;

  if (offset > 0) {
    rows = rows.slice(offset);
  }
  if (limit != null) {
    rows = rows.slice(0, limit);
  }
  return rows;
};
