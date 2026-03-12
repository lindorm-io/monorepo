import type { ReadConcernLevel, W } from "mongodb";
import type { IsolationLevel } from "../../../../types/transaction-options";

export type MongoTransactionConcern = {
  readConcern: { level: ReadConcernLevel };
  writeConcern: { w: W };
};

/**
 * Map a Proteus isolation level to MongoDB read/write concern.
 *
 * - "READ COMMITTED"  -> readConcern: "majority",  writeConcern: { w: "majority" }
 * - "REPEATABLE READ" -> readConcern: "snapshot",   writeConcern: { w: "majority" }
 * - "SERIALIZABLE"    -> readConcern: "snapshot",   writeConcern: { w: "majority" }
 *
 * Default (no isolation level specified) uses "majority" read concern.
 */
export const mapIsolationLevel = (
  isolation?: IsolationLevel,
): MongoTransactionConcern => {
  switch (isolation) {
    case "REPEATABLE READ":
    case "SERIALIZABLE":
      return {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      };

    case "READ COMMITTED":
    default:
      return {
        readConcern: { level: "majority" },
        writeConcern: { w: "majority" },
      };
  }
};
