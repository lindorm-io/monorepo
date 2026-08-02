import type { Condition } from "@lindorm/match";
import { Matcher } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
import { typedJsonMetaDictKey } from "../../entity/utils/typed-json.js";
import type { ResolvedFilter } from "./resolve-filters.js";

/**
 * Test whether a single row matches a predicate criteria.
 */
export const matchesRow = (row: Dict, criteria: Condition<any>): boolean =>
  Matcher.match(row as Record<string, unknown>, criteria);

/**
 * Project a row down to the selected field keys.
 * Returns the original row unchanged when selections is null or empty.
 *
 * A @TypedJson field carries its type metadata in a companion entry keyed by
 * `typedJsonMetaDictKey`; that entry rides along with its data key, otherwise a
 * projected typed-json field silently degrades to untyped JSON on hydration.
 */
export const applySelect = (row: Dict, selections: Array<string> | null): Dict => {
  if (!selections || selections.length === 0) return row;
  const result: Dict = {};
  for (const key of selections) {
    if (key in row) result[key] = row[key];

    const metaKey = typedJsonMetaDictKey(key);
    if (metaKey in row) result[metaKey] = row[metaKey];
  }
  return result;
};

/**
 * Apply resolved filter predicates to rows using Matcher.filter.
 */
export const applyResolvedFilters = (
  rows: Array<Dict>,
  filters: Array<ResolvedFilter>,
): Array<Dict> => {
  for (const filter of filters) {
    rows = Matcher.filter(rows as Array<Record<string, unknown>>, filter.predicate);
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
