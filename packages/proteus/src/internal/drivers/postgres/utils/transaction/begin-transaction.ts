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

export type BeginTransactionHooks = {
  /**
   * Called after the PoolClient is acquired but before BEGIN. Returns an
   * optional disposer run when the handle's release() fires. Used to wire
   * per-connection abort listeners that fire pg_cancel_backend on signal.
   */
  onAcquired?: (poolClient: PoolClient) => (() => void) | undefined;
};

export const beginTransaction = async (
  pool: Pool,
  createPgClient: (poolClient: PoolClient) => PostgresQueryClient,
  isolation?: IsolationLevel,
  hooks?: BeginTransactionHooks,
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

  const dispose = hooks?.onAcquired?.(poolClient);

  try {
    const client = createPgClient(poolClient);
    const sql = isolation ? ISOLATION_SQL[isolation] : "BEGIN";

    await client.query(sql);

    return {
      client,
      release: () => {
        dispose?.();
        poolClient.release();
      },
      state: "active",
      savepointCounter: 0,
    };
  } catch (error) {
    dispose?.();
    poolClient.release();
    throw new PostgresTransactionError("Failed to begin transaction", {
      error: error as Error,
    });
  }
};
