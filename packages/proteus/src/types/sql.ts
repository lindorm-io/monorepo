/**
 * Re-export SQL tagged template utilities for raw SQL fragments.
 *
 * - `SqlFragment` — type representing a parameterized SQL fragment
 * - `sql` — tagged template literal for building safe, parameterized SQL: `` sql`SELECT * FROM ${table}` ``
 * - `isSqlFragment` — type guard to check if a value is a SqlFragment
 */
export type { SqlFragment } from "#internal/types/query";
export {
  sql,
  isSqlFragment,
} from "../internal/drivers/postgres/utils/query/sql-fragment";
