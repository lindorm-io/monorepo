import type { PostgresTransactionHandle } from "../../types/postgres-transaction-handle";
import { assertActiveTransaction } from "./assert-active-transaction";

export const releaseSavepoint = async (
  handle: PostgresTransactionHandle,
  name: string,
): Promise<void> => {
  assertActiveTransaction(handle);
  await handle.client.query(`RELEASE SAVEPOINT "${name}"`);
};
