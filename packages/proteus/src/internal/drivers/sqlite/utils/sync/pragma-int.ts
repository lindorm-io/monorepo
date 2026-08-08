import { isBigInt, isNumber } from "@lindorm/is";
import { SqliteSyncError } from "../../errors/SqliteSyncError.js";

/**
 * Narrows an integer column of a PRAGMA result row to a JS number.
 *
 * The driver opens every connection with `defaultSafeIntegers(true)`, which
 * applies to PRAGMA results as much as to user tables — so `notnull`, `pk`,
 * `hidden`, `seq`, `seqno`, `unique` and `partial` arrive as **BigInt**. A
 * strict `=== 1` against a BigInt is always false, and subtracting two BigInts
 * inside a sort comparator throws (`ToNumber` rejects a BigInt), so every
 * PRAGMA integer must be narrowed here before the snapshot is built.
 *
 * PRAGMA integer columns are never NULL; anything else is a driver contract
 * break rather than a value to coerce.
 */
export const pragmaInt = (value: unknown, column: string): number => {
  if (isNumber(value)) return value;
  if (isBigInt(value)) return Number(value);

  throw new SqliteSyncError(`PRAGMA column "${column}" is not an integer`, {
    code: "schema_mismatch",
    title: "Schema Mismatch",
    details:
      "A PRAGMA introspection row returned a non-integer where SQLite documents an integer.",
    data: { column },
  });
};
