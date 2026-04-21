import { PostgresSyncError } from "../../errors/PostgresSyncError.js";
import type { DbConstraint } from "../../types/db-snapshot.js";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";

type ConstraintRow = {
  table_schema: string;
  table_name: string;
  constraint_name: string;
  constraint_type: string;
  column_names: Array<string>;
  foreign_schema: string | null;
  foreign_table: string | null;
  foreign_columns: Array<string> | null;
  on_delete: string | null;
  on_update: string | null;
  check_expr: string | null;
  is_deferrable: boolean;
  initially_deferred: boolean;
};

const mapAction = (code: string | null): string | null => {
  switch (code) {
    case "a":
      return "NO ACTION";
    case "r":
      return "RESTRICT";
    case "c":
      return "CASCADE";
    case "n":
      return "SET NULL";
    case "d":
      return "SET DEFAULT";
    default:
      return null;
  }
};

const mapConstraintType = (contype: string): DbConstraint["type"] => {
  switch (contype) {
    case "p":
      return "PRIMARY KEY";
    case "u":
      return "UNIQUE";
    case "f":
      return "FOREIGN KEY";
    case "c":
      return "CHECK";
    default:
      throw new PostgresSyncError(`Unknown constraint type: ${contype}`);
  }
};

export const introspectConstraints = async (
  client: PostgresQueryClient,
  schemas: Array<string>,
  tables: Array<string>,
): Promise<Array<{ schema: string; table: string; constraint: DbConstraint }>> => {
  if (schemas.length === 0 || tables.length === 0) return [];

  const { rows } = await client.query<ConstraintRow>(
    `
    SELECT
      n.nspname AS table_schema,
      c.relname AS table_name,
      con.conname AS constraint_name,
      con.contype AS constraint_type,
      (ARRAY(
        SELECT a.attname::text
        FROM unnest(con.conkey) WITH ORDINALITY AS k(num, ord)
        JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.num
        ORDER BY k.ord
      ))::text[] AS column_names,
      fn.nspname AS foreign_schema,
      fc.relname AS foreign_table,
      CASE WHEN con.confrelid != 0 THEN (ARRAY(
        SELECT a.attname::text
        FROM unnest(con.confkey) WITH ORDINALITY AS k(num, ord)
        JOIN pg_catalog.pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.num
        ORDER BY k.ord
      ))::text[] ELSE NULL END AS foreign_columns,
      con.confdeltype AS on_delete,
      con.confupdtype AS on_update,
      CASE WHEN con.contype = 'c' THEN pg_get_constraintdef(con.oid) ELSE NULL END AS check_expr,
      con.condeferrable AS is_deferrable,
      con.condeferred AS initially_deferred
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_catalog.pg_class fc ON fc.oid = con.confrelid
    LEFT JOIN pg_catalog.pg_namespace fn ON fn.oid = fc.relnamespace
    WHERE n.nspname = ANY($1)
      AND c.relname = ANY($2)
      AND con.contype IN ('p', 'u', 'f', 'c')
    ORDER BY n.nspname, c.relname, con.conname
    `,
    [schemas, tables],
  );

  return rows.map((row) => ({
    schema: row.table_schema,
    table: row.table_name,
    constraint: {
      name: row.constraint_name,
      type: mapConstraintType(row.constraint_type),
      columns: row.column_names,
      foreignSchema: row.constraint_type === "f" ? row.foreign_schema : null,
      foreignTable: row.constraint_type === "f" ? row.foreign_table : null,
      foreignColumns: row.constraint_type === "f" ? row.foreign_columns : null,
      onDelete: row.constraint_type === "f" ? mapAction(row.on_delete) : null,
      onUpdate: row.constraint_type === "f" ? mapAction(row.on_update) : null,
      checkExpr: row.check_expr,
      deferrable: row.is_deferrable,
      initiallyDeferred: row.initially_deferred,
    },
  }));
};
