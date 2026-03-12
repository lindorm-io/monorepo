import type { SqliteQueryClient } from "../../types/sqlite-query-client";
import type { SqliteTransactionHandle } from "../../types/sqlite-transaction-handle";
import { SqliteTransactionError } from "../../errors/SqliteTransactionError";

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
