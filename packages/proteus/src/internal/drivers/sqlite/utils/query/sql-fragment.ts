import { isObjectLike } from "@lindorm/is";
import type { SqlFragment } from "#internal/types/query";

/**
 * Tagged template literal for creating parameterized SQL fragments.
 *
 * Usage:
 *   sql`column > ${minValue} AND column < ${maxValue}`
 *   // => { __brand: "SqlFragment", sql: "column > ? AND column < ?", params: [minValue, maxValue] }
 *
 * Values interpolated via ${} become positional `?` placeholders.
 * Since SQLite uses `?` for all params, no reindexing is needed when embedding
 * fragments — just concatenate the SQL texts and params arrays.
 */
export const sql = (
  strings: TemplateStringsArray,
  ...values: Array<unknown>
): SqlFragment => {
  const parts: Array<string> = [];
  const params: Array<unknown> = [];

  for (let i = 0; i < strings.length; i++) {
    parts.push(strings[i]);
    if (i < values.length) {
      const value = values[i];
      if (isSqlFragment(value)) {
        // Inline nested fragment: just concatenate SQL and params (no reindexing needed)
        params.push(...value.params);
        parts.push(value.sql);
      } else {
        params.push(value);
        parts.push("?");
      }
    }
  }

  return { __brand: "SqlFragment", sql: parts.join(""), params };
};

export const isSqlFragment = (value: unknown): value is SqlFragment =>
  isObjectLike(value) && (value as any).__brand === "SqlFragment";
