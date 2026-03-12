import type { PostgresQueryClient } from "./postgres-query-client";

export type PostgresTransactionHandle = {
  readonly client: PostgresQueryClient;
  readonly release: () => void;
  state: "active" | "committed" | "rolledback";
  savepointCounter: number;
};
