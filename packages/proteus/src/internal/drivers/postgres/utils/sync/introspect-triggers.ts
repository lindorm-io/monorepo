import type { PostgresQueryClient } from "../../types/postgres-query-client";

export type TriggerRow = {
  schema: string;
  table: string;
  triggerName: string;
};

/**
 * Introspects user-defined triggers on the managed tables. Only returns triggers
 * whose names start with the proteus prefix ("proteus_") so we never conflict
 * with user-created triggers outside of proteus management.
 */
export const introspectTriggers = async (
  client: PostgresQueryClient,
  schemas: Array<string>,
  tables: Array<string>,
): Promise<Array<TriggerRow>> => {
  if (schemas.length === 0 || tables.length === 0) return [];

  const { rows } = await client.query<TriggerRow>(
    `
    SELECT
      n.nspname AS "schema",
      c.relname AS "table",
      t.tgname  AS "triggerName"
    FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ANY($1)
      AND c.relname = ANY($2)
      AND NOT t.tgisinternal
      AND t.tgname LIKE 'proteus_%'
    ORDER BY n.nspname, c.relname, t.tgname
    `,
    [schemas, tables],
  );

  return rows;
};
