import type { PostgresTransactionHandle } from "../../types/postgres-transaction-handle";
import { assertActiveTransaction } from "./assert-active-transaction";

export const rollbackToSavepoint = async (
  handle: PostgresTransactionHandle,
  name: string,
): Promise<void> => {
  assertActiveTransaction(handle);
  await handle.client.query(`ROLLBACK TO SAVEPOINT "${name}"`);
};
