import type { IAmphora } from "@lindorm/amphora";
import { isArray, isObjectLike, isString } from "@lindorm/is";
import { JsonKit } from "@lindorm/json-kit";
import type { MetaField } from "../types/metadata.js";
import { decryptFieldValue } from "./decrypt-field-value.js";
import { encryptFieldValue } from "./encrypt-field-value.js";

/**
 * Helpers for the @TypedJson sidecar mechanism.
 *
 * A typed-json field stores its JSON-safe `data` in the normal (queryable) data
 * column and the JsonKit type `meta` in a separate sidecar column. On read the
 * two are recombined losslessly (Date/Buffer/BigInt/undefined). The data column
 * is always the source of truth — reconstruction never throws.
 */

/** Dict key under which the raw sidecar value is carried into defaultHydrateEntity. */
export const typedJsonMetaDictKey = (fieldKey: string): string =>
  `__typemeta__:${fieldKey}`;

/** SELECT alias for the sidecar column, paired with the `${alias}_${key}` data alias. */
export const typedJsonMetaAlias = (tableAlias: string, fieldKey: string): string =>
  `${tableAlias}_${fieldKey}__typemeta`;

export type SplitTypedJson = {
  /** JSON-safe payload for the data column (Date → ISO string, BigInt → string, …). */
  data: unknown;
  /** Stringified type metadata for the sidecar column, or null when there is none. */
  meta: string | null;
};

/**
 * Split a typed-json value into its queryable `data` and stringified `meta`.
 * Null/undefined → both null. Non-structured values pass through with null meta.
 */
export const splitTypedJson = (value: unknown): SplitTypedJson => {
  if (value === null || value === undefined) return { data: null, meta: null };
  if (!isArray(value) && !isObjectLike(value)) return { data: value, meta: null };

  try {
    const { data, meta } = JsonKit.split(value as Array<any> | Record<string, any>);
    return { data, meta: JSON.stringify(meta) };
  } catch {
    return { data: value, meta: null };
  }
};

/**
 * Entity-side value → the two storage halves of a @TypedJson field: `transform.to`,
 * then SPLIT, then encrypt EACH half independently.
 *
 * The order is load-bearing. Encrypting before the split would hand AesKit the live
 * value, and AesKit JSON-stringifies whatever it is given — a nested BigInt throws
 * outright and a nested Date collapses to a string, destroying exactly what
 * @TypedJson exists to preserve. Splitting first leaves two encryptable strings-or-
 * JSON-safe values. The sidecar is sealed too: a plaintext type map would leak the
 * shape of the value the data column hides.
 *
 * This is the ONLY place the write-side order is decided — every driver's dehydrate
 * and every partial-update compiler routes through it.
 */
export const dehydrateTypedJson = (
  field: MetaField,
  value: unknown,
  amphora: IAmphora | undefined,
  entityName: string,
): SplitTypedJson => {
  const transformed =
    value != null && field.transform ? field.transform.to(value) : value;

  const { data, meta } = splitTypedJson(transformed);

  const encrypted = field.encrypted;
  if (!encrypted || !amphora) return { data, meta };

  const seal = (half: unknown): string =>
    encryptFieldValue(half, encrypted, amphora, field.key, entityName);

  return {
    data: data == null ? null : seal(data),
    meta: meta === null ? null : seal(meta),
  };
};

/**
 * The two storage halves → the entity-side value: decrypt EACH half, rejoin, then
 * `transform.from`. The exact inverse of dehydrateTypedJson.
 */
export const hydrateTypedJson = (
  field: MetaField,
  rawData: unknown,
  rawMeta: unknown,
  amphora: IAmphora | undefined,
  entityName: string,
): unknown => {
  const encrypted = field.encrypted;

  const open = (half: unknown): unknown =>
    encrypted && amphora && isString(half)
      ? decryptFieldValue(half, encrypted, amphora, field.key, entityName)
      : half;

  const value = joinTypedJson(open(rawData), open(rawMeta));

  return value != null && field.transform ? field.transform.from(value) : value;
};

export type TypedJsonColumnValue = { column: string; value: unknown };

/**
 * Produce the data + sidecar (column, value) pairs for a changed typed-json value.
 * `coerce` applies the driver's json write coercion to the data column; the sidecar
 * carries its (possibly sealed) meta string unchanged.
 */
export const typedJsonChangedColumns = (
  field: MetaField,
  value: unknown,
  coerce: (data: unknown) => unknown,
  amphora: IAmphora | undefined,
  entityName: string,
): Array<TypedJsonColumnValue> => {
  const { data, meta } = dehydrateTypedJson(field, value, amphora, entityName);
  return [
    { column: field.name, value: coerce(data) },
    { column: field.typedJson!.column, value: meta },
  ];
};

const safeParse = (value: unknown): unknown => {
  if (!isString(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

/**
 * Lenient reconstruction for the read path. The data column is authoritative —
 * a missing/stale/corrupt sidecar falls back to the plain parsed data, never throws.
 */
export const joinTypedJson = (rawData: unknown, rawMeta: unknown): unknown => {
  const data = safeParse(rawData);
  if (data === null || data === undefined) return data;
  if (rawMeta === null || rawMeta === undefined) return data;

  try {
    const meta = safeParse(rawMeta);
    if (!isArray(meta) && !isObjectLike(meta)) return data;
    return JsonKit.join(
      data as Array<any> | Record<string, any>,
      meta as Array<any> | Record<string, any>,
    );
  } catch {
    return data;
  }
};
