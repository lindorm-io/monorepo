import type { Dict } from "@lindorm/types";

/**
 * Join a row's key columns into one comparable string, or `null` when any part
 * is nullish — SQL's `IN (…)` never matches on NULL, so neither does this.
 */
export const compositeKey = (row: Dict, keys: Array<string>): string | null => {
  const values: Array<unknown> = [];
  for (const key of keys) {
    const value = row[key];
    if (value == null) return null;
    values.push(value instanceof Date ? value.toISOString() : value);
  }
  return JSON.stringify(values);
};

/**
 * Match root rows to candidate foreign rows on a key tuple, in one pass over
 * each side. Every root row gets an entry, so a root that matched nothing is an
 * EMPTY relation rather than an absent one.
 */
export const indexAndMatch = (
  rows: Array<Dict>,
  candidates: Array<Dict>,
  localKeys: Array<string>,
  foreignKeys: Array<string>,
): Map<Dict, Array<Dict>> => {
  const byKey = new Map<string, Array<Dict>>();
  for (const candidate of candidates) {
    const key = compositeKey(candidate, foreignKeys);
    if (key === null) continue;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(candidate);
    else byKey.set(key, [candidate]);
  }

  const result = new Map<Dict, Array<Dict>>();
  for (const row of rows) {
    const key = compositeKey(row, localKeys);
    result.set(row, key === null ? [] : (byKey.get(key) ?? []));
  }
  return result;
};
