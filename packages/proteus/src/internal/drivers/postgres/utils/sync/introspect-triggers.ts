import type { PostgresQueryClient } from "../../types/postgres-query-client.js";

export type TriggerRow = {
  schema: string;
  table: string;
  triggerName: string;
};

/**
 * Introspects user-defined triggers on the managed tables. Only returns triggers
 * whose names start with the proteus prefix ("proteus_") so we never conflict
 * with user-created triggers outside of proteus management.
 *
 * The `_` is escaped: unescaped it is LIKE's single-character wildcard, so the
 * filter would also claim a user trigger named `proteusXyz` as proteus-managed —
 * and proteus-managed is exactly what `diffSchema` drops. The template literal
 * needs `\\` to emit the one backslash PostgreSQL sees; a single `\` would be
 * consumed by JS and silently leave the pattern unescaped. Backslash is a plain
 * character inside a string literal while `standard_conforming_strings` is on,
 * which it is by default.
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
      AND t.tgname LIKE 'proteus\\_%' ESCAPE '\\'
    ORDER BY n.nspname, c.relname, t.tgname
    `,
    [schemas, tables],
  );

  return rows;
};
