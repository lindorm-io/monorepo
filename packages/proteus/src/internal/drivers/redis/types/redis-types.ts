export type RedisTransactionHandle = {
  state: "active" | "committed" | "rolledBack";
};
