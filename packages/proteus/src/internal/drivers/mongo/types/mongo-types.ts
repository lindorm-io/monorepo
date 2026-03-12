import type { ClientSession } from "mongodb";

export type MongoTransactionHandle = {
  session: ClientSession | undefined;
  state: "active" | "committed" | "rolledBack";
};
