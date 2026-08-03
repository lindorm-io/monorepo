import {
  isArray,
  isBigInt,
  isBoolean,
  isBuffer,
  isNumber,
  isObjectLike,
  isString,
} from "@lindorm/is";
import type { MetaField } from "../../../entity/types/metadata.js";
import { stringifyForStorage } from "../../../entity/utils/stringify-for-storage.js";

/**
 * Coerce one already-transformed, already-encrypted value into the UTF-8 string
 * a Redis HASH field stores.
 *
 * Shared by `serializeHash` (the full-row write) and the partial-update paths
 * (`RedisExecutor.executeUpdateMany`, `RedisQueryBuilder`'s update), which used
 * to hand-roll `String(value)` — that flattened a plain json/object/array value
 * to "[object Object]" and utf8-mangled a Buffer, so a partial update corrupted
 * what a full write stored correctly.
 */
export const coerceHashValue = (value: unknown, field: MetaField | null): string => {
  // An encrypted value is already string ciphertext; the json/object/array
  // branch below would stringify that string a second time.
  if (field?.encrypted && isString(value)) return value;

  // A Redis hash value is read back as a UTF-8 string, so raw bytes cannot be
  // stored verbatim — they are base64-encoded. NOT the `{"type":"Buffer",
  // "data":[…]}` shape a plain stringify emits: that string cannot be decoded
  // back into the original bytes, so binary columns round-tripped to garbage.
  if (field?.type === "binary" && isBuffer(value)) return value.toString("base64");

  if (isBoolean(value)) return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  if (isBigInt(value)) return String(value);
  if (isNumber(value)) return String(value);

  // Bigint-hardened stringify: a typed bigint array (@Field("array", { arrayType:
  // "bigint" })) stores each element as a decimal string rather than throwing;
  // deserialise restores the exact BigInt on read.
  if (field?.type === "array" || field?.type === "json" || field?.type === "object") {
    return stringifyForStorage(value);
  }

  if (isArray(value) || isObjectLike(value)) {
    return stringifyForStorage(value);
  }

  return String(value);
};
