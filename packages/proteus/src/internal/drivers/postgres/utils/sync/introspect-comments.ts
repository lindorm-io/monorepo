import type { PostgresQueryClient } from "../../types/postgres-query-client.js";

export type CommentRow = {
  schema: string;
  table: string;
  column: string | null;
  comment: string;
};

export const introspectComments = async (
  client: PostgresQueryClient,
  schemas: Array<string>,
  tables: Array<string>,
): Promise<Array<CommentRow>> => {
  if (schemas.length === 0 || tables.length === 0) return [];

  const { rows } = await client.query<CommentRow>(
    `
    SELECT
      n.nspname AS schema,
      c.relname AS table,
      CASE WHEN d.objsubid > 0
        THEN a.attname
        ELSE NULL
      END AS column,
      d.description AS comment
    FROM pg_catalog.pg_description d
    JOIN pg_catalog.pg_class c ON c.oid = d.objoid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_catalog.pg_attribute a
      ON a.attrelid = d.objoid AND a.attnum = d.objsubid
    WHERE n.nspname = ANY($1)
      AND c.relname = ANY($2)
      AND c.relkind IN ('r', 'p')
      AND d.description IS NOT NULL
      AND d.description != ''
    ORDER BY n.nspname, c.relname, d.objsubid
    `,
    [schemas, tables],
  );

  return rows;
};
