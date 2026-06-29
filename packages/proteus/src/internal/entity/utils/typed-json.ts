import { isArray, isObjectLike, isString } from "@lindorm/is";
import { JsonKit } from "@lindorm/json-kit";
import type { MetaField } from "../types/metadata.js";

/**
 * Helpers for the @TypedJson sidecar mechanism.
 *
 * A typed-json field stores its JSON-safe `data` in the normal (queryable) data
 * column and the JsonKit type `meta` in a separate sidecar column. On read the
 * two are recombined losslessly (Date/Buffer/BigInt/undefined). The data column
 * is always the source of truth — reconstruction never throws.
 */

export const isTypedJsonField = (field: MetaField | null | undefined): boolean =>
  field?.typedJson != null;

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

export type TypedJsonColumnValue = { column: string; value: unknown };

/**
 * Produce the data + sidecar (column, value) pairs for a changed typed-json value.
 * `coerce` applies the driver's json write coercion to the data column; the sidecar
 * carries the stringified meta unchanged.
 */
export const typedJsonChangedColumns = (
  field: MetaField,
  value: unknown,
  coerce: (data: unknown) => unknown,
): Array<TypedJsonColumnValue> => {
  const { data, meta } = splitTypedJson(value);
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
