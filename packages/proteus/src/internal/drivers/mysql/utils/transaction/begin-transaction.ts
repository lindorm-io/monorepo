import type { Pool, PoolConnection } from "mysql2/promise";
import type { IsolationLevel } from "../../../../../types/transaction-options";
import { MySqlTransactionError } from "../../errors/MySqlTransactionError";
import type { MysqlQueryClient } from "../../types/mysql-query-client";
import type { MysqlTransactionHandle } from "../../types/mysql-transaction-handle";

const SET_ISOLATION_SQL: Record<IsolationLevel, string> = {
  "READ COMMITTED": "SET TRANSACTION ISOLATION LEVEL READ COMMITTED",
  "REPEATABLE READ": "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ",
  SERIALIZABLE: "SET TRANSACTION ISOLATION LEVEL SERIALIZABLE",
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

  try {
    const client = createMysqlClient(connection);

    if (isolation) {
      await client.query(SET_ISOLATION_SQL[isolation]);
    }

    await client.query("START TRANSACTION");

    return {
      client,
      connection,
      release: () => connection.release(),
      state: "active",
      savepointCounter: 0,
    };
  } catch (error) {
    connection.release();
    throw new MySqlTransactionError("Failed to begin transaction", {
      error: error as Error,
    });
  }
};
