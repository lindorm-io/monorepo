import type { MysqlQueryClient } from "./mysql-query-client.js";

export type MysqlTransactionHandle = {
  readonly client: MysqlQueryClient;
  readonly connection: unknown; // PoolConnection — kept opaque to avoid importing mysql2 types at the type level
  readonly release: () => void;
  state: "active" | "committed" | "rolledback";
  savepointCounter: number;
};
