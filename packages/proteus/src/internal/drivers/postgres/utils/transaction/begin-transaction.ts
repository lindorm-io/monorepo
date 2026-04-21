import type { Pool, PoolClient } from "pg";
import type { IsolationLevel } from "../../../../../types/transaction-options.js";
import { PostgresTransactionError } from "../../errors/PostgresTransactionError.js";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";
import type { PostgresTransactionHandle } from "../../types/postgres-transaction-handle.js";

const ISOLATION_SQL: Record<IsolationLevel, string> = {
  "READ COMMITTED": "BEGIN ISOLATION LEVEL READ COMMITTED",
  "REPEATABLE READ": "BEGIN ISOLATION LEVEL REPEATABLE READ",
  SERIALIZABLE: "BEGIN ISOLATION LEVEL SERIALIZABLE",
};

export const beginTransaction = async (
  pool: Pool,
  createPgClient: (poolClient: PoolClient) => PostgresQueryClient,
  isolation?: IsolationLevel,
): Promise<PostgresTransactionHandle> => {
  if (isolation && !(isolation in ISOLATION_SQL)) {
    throw new PostgresTransactionError(`Invalid isolation level: "${isolation}"`, {
      debug: { isolation, valid: Object.keys(ISOLATION_SQL) },
    });
  }

  let poolClient: PoolClient;

  try {
    poolClient = await pool.connect();
  } catch (error) {
    throw new PostgresTransactionError("Failed to acquire pool connection", {
      error: error as Error,
    });
  }

  try {
    const client = createPgClient(poolClient);
    const sql = isolation ? ISOLATION_SQL[isolation] : "BEGIN";

    await client.query(sql);

    return {
      client,
      release: () => poolClient.release(),
      state: "active",
      savepointCounter: 0,
    };
  } catch (error) {
    poolClient.release();
    throw new PostgresTransactionError("Failed to begin transaction", {
      error: error as Error,
    });
  }
};
