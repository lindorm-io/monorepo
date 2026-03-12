import { Client } from "pg";
import { PostgresQueryClient } from "../drivers/postgres/types/postgres-query-client";

const PG_CONNECTION = "postgres://root:example@localhost:5432/default";

export const createTestPgClient = async (): Promise<{
  client: PostgresQueryClient;
  raw: Client;
}> => {
  const raw = new Client({ connectionString: PG_CONNECTION });
  await raw.connect();

  const client: PostgresQueryClient = {
    query: async <R = Record<string, unknown>>(sql: string, params?: Array<unknown>) => {
      const result = await raw.query(sql, params);
      return { rows: result.rows as Array<R>, rowCount: result.rowCount ?? 0 };
    },
  };

  return { client, raw };
};
