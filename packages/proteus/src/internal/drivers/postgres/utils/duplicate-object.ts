import { isError, isString } from "@lindorm/is";

/**
 * Postgres sqlstates that mean "this object already exists".
 *
 * `CREATE ... IF NOT EXISTS` is not atomic: the existence check and the catalog
 * insert are separate steps, so two sessions can both pass the check and the
 * loser surfaces one of these instead of the no-op it asked for.
 *
 * - `23505` unique_violation — a catalog index rejected the duplicate row
 *   (`pg_extension_name_index` for a racing `CREATE EXTENSION`)
 * - `42710` duplicate_object — the object name is already taken
 * - `42P07` duplicate_table / `42723` duplicate_function — an object the
 *   extension installs was created by the peer first
 *
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const PG_DUPLICATE_OBJECT_SQLSTATES = new Set(["23505", "42710", "42P07", "42723"]);

/**
 * Duck-type check for pg driver errors that mean "already exists". Says nothing
 * about whether the duplicate is BENIGN — the caller must confirm that the
 * object it wanted is actually present before swallowing the error.
 */
export const isPgDuplicateObjectError = (err: unknown): boolean => {
  if (!isError(err)) return false;

  const code = (err as { code?: unknown }).code;

  return isString(code) && PG_DUPLICATE_OBJECT_SQLSTATES.has(code);
};
