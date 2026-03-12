/**
 * Rewrites `$N` placeholders in a SQL fragment to account for an offset
 * and appends the fragment's params to the global params array.
 *
 * This is the core utility for embedding raw SQL fragments, subqueries,
 * and CTEs into a larger query with shared parameterization.
 */
export const reindexParams = (
  sql: string,
  fragmentParams: ReadonlyArray<unknown>,
  globalParams: Array<unknown>,
): string => {
  const offset = globalParams.length;
  globalParams.push(...fragmentParams);
  if (offset === 0) return sql;
  return sql.replace(/\$([1-9]\d*)/g, (_, n) => `$${Number(n) + offset}`);
};
