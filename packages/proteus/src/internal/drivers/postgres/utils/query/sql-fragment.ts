import { isObjectLike } from "@lindorm/is";
import type { SqlFragment } from "../../../../types/query";

/**
 * Tagged template literal for creating parameterized SQL fragments.
 *
 * Usage:
 *   sql`column > ${minValue} AND column < ${maxValue}`
 *   // => { __brand: "SqlFragment", sql: "column > $1 AND column < $2", params: [minValue, maxValue] }
 *
 * Values interpolated via ${} become parameterized $N placeholders.
 * The $N indices are local to the fragment; reindexParams() offsets them
 * when embedding into a larger query.
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
        // Inline nested fragment: reindex its $N placeholders
        // Use regex with word boundary to avoid $1 matching inside $10, $11, etc.
        let nestedSql = value.sql;
        for (let j = value.params.length; j >= 1; j--) {
          nestedSql = nestedSql.replace(
            new RegExp(`\\$${j}(?!\\d)`, "g"),
            `$${params.length + j}`,
          );
        }
        params.push(...value.params);
        parts.push(nestedSql);
      } else {
        params.push(value);
        parts.push(`$${params.length}`);
      }
    }
  }

  return { __brand: "SqlFragment", sql: parts.join(""), params };
};

export const isSqlFragment = (value: unknown): value is SqlFragment =>
  isObjectLike(value) && (value as any).__brand === "SqlFragment";
