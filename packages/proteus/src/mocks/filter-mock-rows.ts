import { Predicated } from "@lindorm/utils";

/**
 * Filter an in-memory row array by an optional criteria predicate, using the
 * same matcher (`Predicated`) the memory driver applies — so a seeded mock
 * honours the same operator semantics ($eq, $in, $gt, …) as a live query.
 * Returns every row when no criteria is given.
 */
export const filterMockRows = <T>(rows: Array<T>, criteria?: unknown): Array<T> =>
  criteria ? (Predicated.filter(rows as Array<any>, criteria as any) as Array<T>) : rows;
