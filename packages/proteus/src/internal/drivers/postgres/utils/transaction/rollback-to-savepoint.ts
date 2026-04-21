import type { PostgresTransactionHandle } from "../../types/postgres-transaction-handle.js";
import { assertActiveTransaction } from "./assert-active-transaction.js";

export const rollbackToSavepoint = async (
  handle: PostgresTransactionHandle,
  name: string,
): Promise<void> => {
  assertActiveTransaction(handle);
  await handle.client.query(`ROLLBACK TO SAVEPOINT "${name}"`);
};
