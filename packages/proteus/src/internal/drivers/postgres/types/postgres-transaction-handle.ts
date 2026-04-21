import type { PostgresQueryClient } from "./postgres-query-client.js";

export type PostgresTransactionHandle = {
  readonly client: PostgresQueryClient;
  readonly release: () => void;
  state: "active" | "committed" | "rolledback";
  savepointCounter: number;
};
