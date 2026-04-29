import type { SqliteQueryClient } from "./sqlite-query-client.js";

export type SqliteTransactionHandle = {
  readonly client: SqliteQueryClient;
  state: "active" | "committed" | "rolledback";
  savepointCounter: number;
};
