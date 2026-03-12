import type { DbColumn, DbTable } from "../../types/db-snapshot";
import type { PostgresQueryClient } from "../../types/postgres-query-client";

type ColumnRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
  formatted_type: string;
  is_nullable: boolean;
  default_expr: string | null;
  is_identity: boolean;
  identity_generation: string | null;
  is_generated: boolean;
  generation_expr: string | null;
  collation_name: string | null;
};

export const introspectTables = async (
  client: PostgresQueryClient,
  schemas: Array<string>,
  tables: Array<string>,
): Promise<Array<DbTable>> => {
  if (schemas.length === 0 || tables.length === 0) return [];

  const { rows } = await client.query<ColumnRow>(
    `
    SELECT
      n.nspname AS table_schema,
      c.relname AS table_name,
      a.attname AS column_name,
      format_type(a.atttypid, a.atttypmod) AS formatted_type,
      NOT a.attnotnull AS is_nullable,
      pg_get_expr(d.adbin, d.adrelid) AS default_expr,
      a.attidentity != '' AS is_identity,
      CASE a.attidentity
        WHEN 'a' THEN 'ALWAYS'
        WHEN 'd' THEN 'BY DEFAULT'
        ELSE NULL
      END AS identity_generation,
      a.attgenerated != '' AS is_generated,
      CASE WHEN a.attgenerated != '' THEN pg_get_expr(d.adbin, d.adrelid) ELSE NULL END AS generation_expr,
      CASE WHEN co.collname IS NOT NULL AND co.collname != 'default' THEN co.collname ELSE NULL END AS collation_name
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    LEFT JOIN pg_catalog.pg_collation co ON co.oid = a.attcollation AND a.attcollation != 0
    WHERE n.nspname = ANY($1)
      AND c.relname = ANY($2)
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND c.relkind IN ('r', 'p')
    ORDER BY n.nspname, c.relname, a.attnum
    `,
    [schemas, tables],
  );

  const tableMap = new Map<string, DbTable>();

  for (const row of rows) {
    const key = `${row.table_schema}.${row.table_name}`;

    if (!tableMap.has(key)) {
      tableMap.set(key, {
        schema: row.table_schema,
        name: row.table_name,
        columns: [],
        constraints: [],
        indexes: [],
        comment: null,
        columnComments: {},
      });
    }

    const column: DbColumn = {
      name: row.column_name,
      type: row.formatted_type,
      nullable: row.is_nullable,
      defaultExpr: row.is_identity ? null : row.default_expr,
      isIdentity: row.is_identity,
      identityGeneration: row.identity_generation as DbColumn["identityGeneration"],
      isGenerated: row.is_generated,
      generationExpr: row.generation_expr,
      collation: row.collation_name,
    };

    tableMap.get(key)!.columns.push(column);
  }

  return Array.from(tableMap.values());
};
