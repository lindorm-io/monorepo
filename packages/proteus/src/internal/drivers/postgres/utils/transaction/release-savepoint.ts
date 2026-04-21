import type { PostgresTransactionHandle } from "../../types/postgres-transaction-handle.js";
import { assertActiveTransaction } from "./assert-active-transaction.js";

export const releaseSavepoint = async (
  handle: PostgresTransactionHandle,
  name: string,
): Promise<void> => {
  assertActiveTransaction(handle);
  await handle.client.query(`RELEASE SAVEPOINT "${name}"`);
};
