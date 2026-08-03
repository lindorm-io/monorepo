import { isBigInt } from "@lindorm/is";

/**
 * The in-memory store's row key: the primary-key values, in declaration order,
 * as one JSON string.
 *
 * `JSON.stringify` throws on a BigInt, so a bigint PK (or FK-backed lookup) must
 * be tagged to a string first — otherwise every insert/update/save/destroy on a
 * bigint-PK entity crashes. The `n` tag keeps a bigint key distinct from the
 * equivalent string/number, and non-bigint values serialize exactly as before.
 *
 * Shared by MemoryExecutor and MemoryQueryBuilder: the builder hand-rolled a bare
 * `JSON.stringify`, so a bigint-PK insert threw there while the repository path
 * on the very same entity succeeded — and the two produced different keys.
 */
export const serializePk = (
  entity: Record<string, unknown>,
  primaryKeys: Array<string>,
): string =>
  JSON.stringify(
    primaryKeys.map((key) => {
      const value = entity[key];
      return isBigInt(value) ? `${value}n` : value;
    }),
  );
