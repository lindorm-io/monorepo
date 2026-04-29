import type { SqliteQueryClient } from "../../types/sqlite-query-client.js";
import type { SqliteTransactionHandle } from "../../types/sqlite-transaction-handle.js";
import { SqliteTransactionError } from "../../errors/SqliteTransactionError.js";

export const beginTransaction = (client: SqliteQueryClient): SqliteTransactionHandle => {
  try {
    client.exec("BEGIN IMMEDIATE");
  } catch (error) {
    throw new SqliteTransactionError("Failed to begin transaction", {
      error: error as Error,
    });
  }

  return {
    client,
    state: "active",
    savepointCounter: 0,
  };
};
