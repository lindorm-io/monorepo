import type { AggregateFunction } from "../../types/aggregate";

/**
 * Extract numeric values from a field across an array of row-like objects.
 * Filters out null/undefined values and coerces the rest to Number.
 */
export const extractNumericValues = (
  rows: Array<Record<string, unknown>>,
  field: string,
): Array<number> => {
  return rows
    .map((r) => r[field])
    .filter((v) => v != null)
    .map(Number);
};

/**
 * Compute an aggregate (sum/avg/min/max) over a pre-extracted array of numbers.
 * Returns null if the values array is empty.
 *
 * Used by both Repository.executeAggregate and QueryBuilder.computeAggregate
 * in the Memory and Redis drivers, which perform aggregation client-side.
 */
export const computeAggregateFromValues = (
  type: AggregateFunction,
  values: Array<number>,
): number | null => {
  if (values.length === 0) return null;

  switch (type) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return values.reduce((a, b) => (a < b ? a : b));
    case "max":
      return values.reduce((a, b) => (a > b ? a : b));
  }
};
