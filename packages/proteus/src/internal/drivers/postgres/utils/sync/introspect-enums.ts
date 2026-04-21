import type { DbEnum } from "../../types/db-snapshot.js";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";

type EnumRow = {
  schema: string;
  name: string;
  values: Array<string>;
};

export const introspectEnums = async (
  client: PostgresQueryClient,
  schemas: Array<string>,
): Promise<Array<DbEnum>> => {
  if (schemas.length === 0) return [];

  const { rows } = await client.query<EnumRow>(
    `
    SELECT
      n.nspname AS schema,
      t.typname AS name,
      ARRAY_AGG(e.enumlabel::text ORDER BY e.enumsortorder) AS values
    FROM pg_catalog.pg_type t
    JOIN pg_catalog.pg_enum e ON e.enumtypid = t.oid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typtype = 'e'
      AND n.nspname = ANY($1)
    GROUP BY n.nspname, t.typname
    ORDER BY n.nspname, t.typname
    `,
    [schemas],
  );

  return rows.map((row) => ({
    schema: row.schema,
    name: row.name,
    values: row.values,
  }));
};
