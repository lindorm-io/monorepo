/**
 * Build a deterministic _id value for MongoDB documents.
 *
 * For single-PK entities, returns the value directly.
 * For composite PKs, returns an object with keys sorted alphabetically.
 *
 * CRITICAL: MongoDB compound _id matching is order-sensitive.
 * { a: 1, b: 2 } does NOT match { b: 2, a: 1 }. Sorting keys
 * guarantees consistency across all code paths.
 */
export const buildCompoundId = (
  pkFields: Array<string>,
  values: Record<string, unknown>,
): unknown => {
  if (pkFields.length === 1) {
    return values[pkFields[0]];
  }

  const sorted = [...pkFields].sort();
  const result: Record<string, unknown> = {};

  for (const key of sorted) {
    result[key] = values[key];
  }

  return result;
};

/**
 * Build the _id filter for a compound or single PK.
 * Returns { _id: value } ready for MongoDB queries.
 */
export const buildIdFilter = (
  pkFields: Array<string>,
  values: Record<string, unknown>,
): Record<string, unknown> => {
  return { _id: buildCompoundId(pkFields, values) };
};
