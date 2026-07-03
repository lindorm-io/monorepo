import type { RawOrderByEntry } from "../../types/query.js";
import type { SqlDialect } from "./sql-dialect.js";

/**
 * Compile raw ORDER BY fragments into individual clause strings, threading each
 * fragment's params into the shared params array using the driver's placeholder
 * convention.
 *
 * - PostgreSQL renumbers the fragment's `$N` placeholders via `reindexRawParams`.
 * - MySQL / SQLite use positional `?` placeholders, so params are appended in
 *   order and the fragment text is used verbatim.
 *
 * Returns one string per entry (a fragment may itself contain multiple
 * comma-separated terms); callers join them into the ORDER BY list after the
 * field terms.
 */
export const compileRawOrderTerms = (
  rawEntries: Array<RawOrderByEntry>,
  params: Array<unknown>,
  dialect: SqlDialect,
): Array<string> => {
  const clauses: Array<string> = [];

  for (const raw of rawEntries) {
    if (dialect.reindexRawParams) {
      clauses.push(dialect.reindexRawParams(raw.sql, raw.params, params));
    } else {
      params.push(...raw.params);
      clauses.push(raw.sql);
    }
  }

  return clauses;
};
