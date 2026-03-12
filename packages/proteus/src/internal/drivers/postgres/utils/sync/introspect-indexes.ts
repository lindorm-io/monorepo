import type { DbIndex } from "../../types/db-snapshot";
import type { PostgresQueryClient } from "../../types/postgres-query-client";

type IndexRow = {
  table_schema: string;
  table_name: string;
  index_name: string;
  is_unique: boolean;
  method: string;
  column_names: Array<string>;
  column_options: Array<number>;
  num_key_columns: number;
  predicate: string | null;
};

export const introspectIndexes = async (
  client: PostgresQueryClient,
  schemas: Array<string>,
  tables: Array<string>,
): Promise<Array<{ schema: string; table: string; index: DbIndex }>> => {
  if (schemas.length === 0 || tables.length === 0) return [];

  const { rows } = await client.query<IndexRow>(
    `
    SELECT
      n.nspname AS table_schema,
      ct.relname AS table_name,
      ci.relname AS index_name,
      ix.indisunique AS is_unique,
      am.amname AS method,
      (ARRAY(
        SELECT pg_get_indexdef(ix.indexrelid, k.ord::int, true)
        FROM generate_series(1, array_length(ix.indkey, 1)) AS k(ord)
      ))::text[] AS column_names,
      (ARRAY(
        SELECT o::int
        FROM unnest(ix.indoption) AS o
      ))::int[] AS column_options,
      ix.indnkeyatts AS num_key_columns,
      pg_get_expr(ix.indpred, ix.indrelid) AS predicate
    FROM pg_catalog.pg_index ix
    JOIN pg_catalog.pg_class ci ON ci.oid = ix.indexrelid
    JOIN pg_catalog.pg_class ct ON ct.oid = ix.indrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = ct.relnamespace
    JOIN pg_catalog.pg_am am ON am.oid = ci.relam
    WHERE n.nspname = ANY($1)
      AND ct.relname = ANY($2)
      AND NOT ix.indisprimary
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint con
        WHERE con.conindid = ix.indexrelid
          AND con.contype = 'u'
      )
    ORDER BY n.nspname, ct.relname, ci.relname
    `,
    [schemas, tables],
  );

  return rows.map((row) => {
    const numKey = row.num_key_columns;
    const allNames = row.column_names;
    const options = row.column_options;

    // pg_get_indexdef returns quoted identifiers for mixed-case columns
    // (e.g. "deletedAt"). Strip quotes to match desired column names.
    const unquote = (s: string): string => s.replace(/^"|"$/g, "");

    const columns = allNames.slice(0, numKey).map((name, i) => ({
      name: unquote(name),
      direction: options[i] & 1 ? "desc" : "asc",
    }));

    const include = allNames.slice(numKey).map(unquote);

    return {
      schema: row.table_schema,
      table: row.table_name,
      index: {
        name: row.index_name,
        unique: row.is_unique,
        columns,
        method: row.method,
        where: row.predicate,
        include,
      },
    };
  });
};
