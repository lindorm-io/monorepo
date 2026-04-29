import type { Pool, PoolConnection } from "mysql2/promise";
import type { IsolationLevel } from "../../../../../types/transaction-options.js";
import { MySqlTransactionError } from "../../errors/MySqlTransactionError.js";
import type { MysqlQueryClient } from "../../types/mysql-query-client.js";
import type { MysqlTransactionHandle } from "../../types/mysql-transaction-handle.js";

const SET_ISOLATION_SQL: Record<IsolationLevel, string> = {
  "READ COMMITTED": "SET TRANSACTION ISOLATION LEVEL READ COMMITTED",
  "REPEATABLE READ": "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ",
  SERIALIZABLE: "SET TRANSACTION ISOLATION LEVEL SERIALIZABLE",
};

export type BeginMysqlTransactionHooks = {
  /**
   * Called after the PoolConnection is acquired but before START TRANSACTION.
   * Returns an optional disposer run when the handle's release() fires. Used
   * to wire per-connection abort listeners that fire KILL QUERY on signal.
   */
  onAcquired?: (connection: PoolConnection) => (() => void) | undefined;
};

/**
 * Checks out a dedicated connection from the MySQL pool and starts a transaction.
 *
 * MySQL uses `START TRANSACTION` (not `BEGIN`). If an isolation level is specified,
 * it is set on the session before starting the transaction via
 * `SET TRANSACTION ISOLATION LEVEL <level>`.
 */
export const beginTransaction = async (
  pool: Pool,
  createMysqlClient: (connection: PoolConnection) => MysqlQueryClient,
  isolation?: IsolationLevel,
  hooks?: BeginMysqlTransactionHooks,
): Promise<MysqlTransactionHandle> => {
  if (isolation && !(isolation in SET_ISOLATION_SQL)) {
    throw new MySqlTransactionError(`Invalid isolation level: "${isolation}"`, {
      debug: { isolation, valid: Object.keys(SET_ISOLATION_SQL) },
    });
  }

  let connection: PoolConnection;

  try {
    connection = await pool.getConnection();
  } catch (error) {
    throw new MySqlTransactionError("Failed to acquire pool connection", {
      error: error as Error,
    });
  }

  const dispose = hooks?.onAcquired?.(connection);

  try {
    const client = createMysqlClient(connection);

    if (isolation) {
      await client.query(SET_ISOLATION_SQL[isolation]);
    }

    await client.query("START TRANSACTION");

    return {
      client,
      connection,
      release: () => {
        dispose?.();
        connection.release();
      },
      state: "active",
      savepointCounter: 0,
    };
  } catch (error) {
    dispose?.();
    connection.release();
    throw new MySqlTransactionError("Failed to begin transaction", {
      error: error as Error,
    });
  }
};
