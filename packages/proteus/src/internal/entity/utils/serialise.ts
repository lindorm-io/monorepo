import type { MetaFieldMode, MetaFieldType } from "../types/metadata.js";

/**
 * Inverse of `deserialise` for a single scalar value: convert a runtime JS
 * value into a storage-safe primitive that survives native driver storage AND
 * round-trips back to the same JS type via `deserialise`.
 *
 * The only two runtime types that native storage cannot carry losslessly across
 * every driver are:
 *
 * - `bigint` — `JSON.stringify` throws on it (SQLite/MySQL/Redis), and BSON
 *   (Mongo) demotes it to a Number/Long unless `useBigInt64` is set. Store the
 *   decimal string; `deserialise(str, "bigint")` restores the exact `BigInt`.
 * - `Date` — inside a native array node-postgres/BSON handling diverges. Store
 *   the ISO-8601 string; `deserialise(str, "timestamp"|"date")` restores it.
 *
 * Every other scalar (number, boolean, string, uuid, decimal-as-number or
 * decimal-as-string) is already storage-safe and passes through unchanged, so
 * the round-trip stays symmetric across memory/sqlite/mysql/postgres/mongo/redis.
 */
export const serialise = (
  value: any,
  type: MetaFieldType | null,
  _mode?: MetaFieldMode | null,
): any => {
  if (value == null) return value;

  switch (type) {
    case "bigint":
      return typeof value === "bigint" ? value.toString() : String(value);

    case "date":
    case "timestamp":
      return value instanceof Date ? value.toISOString() : value;

    default:
      return value;
  }
};

/**
 * Serialise every element of a typed array (`@Field("array", { arrayType })`)
 * into its storage-safe primitive via {@link serialise}. Non-array values pass
 * through untouched. Used by the drivers that store typed arrays natively
 * (Postgres `type[]` columns, Mongo BSON arrays) so bigint/Date elements do not
 * corrupt or throw on write.
 */
export const serialiseArray = (
  value: any,
  arrayType: MetaFieldType | null,
  mode?: MetaFieldMode | null,
): any =>
  Array.isArray(value)
    ? value.map((element) => serialise(element, arrayType, mode))
    : value;
