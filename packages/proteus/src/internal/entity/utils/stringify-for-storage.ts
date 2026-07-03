/**
 * `JSON.stringify` for values headed into a JSON-string column (SQLite TEXT,
 * MySQL JSON, Redis HASH field), hardened against `bigint`.
 *
 * Plain `JSON.stringify` throws `TypeError: Do not know how to serialize a
 * BigInt`. The only way a `bigint` legitimately reaches this path is inside a
 * typed array (`@Field("array", { arrayType: "bigint" })`) — plain untyped
 * json/object fields with a raw bigint are rejected upstream by
 * `assertSerialisableJsonFields`. Emitting the decimal string keeps the write
 * symmetric with the read: `deserialise(str, "bigint")` restores the exact
 * `BigInt`. `Date` already serialises to an ISO string natively and round-trips
 * via `deserialise(str, "timestamp"|"date")`, so it needs no special handling.
 */
export const stringifyForStorage = (value: unknown): string =>
  JSON.stringify(value, (_key, val) => (typeof val === "bigint" ? val.toString() : val));
