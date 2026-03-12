import type { PostgresTransactionHandle } from "../../types/postgres-transaction-handle";
import { assertActiveTransaction } from "./assert-active-transaction";

export const createSavepoint = async (
  handle: PostgresTransactionHandle,
): Promise<string> => {
  assertActiveTransaction(handle);

  handle.savepointCounter += 1;
  const name = `sp_${handle.savepointCounter}`;

  await handle.client.query(`SAVEPOINT "${name}"`);

  return name;
};
