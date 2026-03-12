import type { Predicate } from "@lindorm/types";

/**
 * Check if a query predicate is a simple PK equality lookup.
 *
 * Returns the PK values in metadata order if ALL primary keys appear as
 * scalar equality conditions (no operators, no arrays, no nested predicates).
 * Returns null otherwise — meaning the query requires a SCAN.
 */
export const extractExactPk = (
  criteria: Predicate<any>,
  primaryKeys: Array<string>,
): Array<unknown> | null => {
  if (!criteria || typeof criteria !== "object") return null;

  const values: Array<unknown> = [];

  for (const pk of primaryKeys) {
    const value = (criteria as Record<string, unknown>)[pk];

    // Must be present and a scalar (not an operator object or array)
    if (value === undefined) return null;
    if (value === null) return null;
    if (typeof value === "object") return null;

    values.push(value);
  }

  return values;
};
