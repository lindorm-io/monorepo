import type { IAmphora } from "@lindorm/amphora";
import type { MetaField } from "../types/metadata.js";
import { encryptFieldValue } from "./encrypt-field-value.js";
import { serialise, serialiseArray } from "./serialise.js";

export type DehydrateFieldValueOptions = {
  amphora?: IAmphora;
  /**
   * The driver's own write coercion — what the NATIVE column accepts. Applied to
   * a plaintext value only; an @Encrypted field never reaches the native column
   * type (its column is TEXT), so its coercion is `serialise` instead.
   */
  coerce?: (value: unknown) => unknown;
};

/**
 * The ONE write-side value pipeline for a single field. Every write path —
 * repository dehydrate, insert/update query builder, partial-update compiler,
 * cache serializer — routes through here, so the order is decided in one place:
 *
 *     transform.to  →  encrypted ? serialise → encrypt : driver coercion
 *
 * Serialising BEFORE encrypting is load-bearing, and it is why the driver's own
 * coercion is bypassed for an @Encrypted field:
 *
 * - `AesKit.encrypt` accepts string/Buffer/array/boolean/number/object and
 *   THROWS on anything else — a `bigint` and a `Date` both fall through its
 *   content-type switch. Encrypting first therefore made `@Encrypted` unusable
 *   on `bigint`, `date` and `timestamp` fields. `serialise` is the exact inverse
 *   of the `deserialise` the read path runs, and turns both into the strings
 *   that round-trip losslessly.
 * - The driver coercion targets the NATIVE column type, but an encrypted column
 *   is projected as TEXT (see each driver's `projectColumnType`). Running it
 *   would be wrong, not merely redundant: MySQL coerces a Date to its local
 *   `YYYY-MM-DD HH:MM:SS.mmm` spelling, which `deserialise` — the only reader an
 *   encrypted column has — would then parse back in the LOCAL timezone.
 *
 * The read path is decrypt → deserialise → `transform.from`; this is its exact
 * inverse.
 */
export const dehydrateFieldValue = (
  value: unknown,
  field: MetaField | null | undefined,
  entityName: string,
  options: DehydrateFieldValueOptions = {},
): unknown => {
  const transformed =
    value != null && field?.transform ? field.transform.to(value) : value;

  if (transformed == null || !field?.encrypted) {
    return options.coerce ? options.coerce(transformed) : transformed;
  }

  return encryptFieldValue(
    storable(transformed, field),
    field.encrypted,
    options.amphora,
    field.key,
    entityName,
  );
};

/**
 * Normalise a plaintext value into something `AesKit.encrypt` accepts AND
 * `deserialise` restores. A typed array is normalised element-wise so a
 * `@Field("array", { arrayType: "bigint" })` does not throw inside the cipher's
 * JSON stringify.
 */
const storable = (value: unknown, field: MetaField): unknown =>
  field.type === "array" && field.arrayType
    ? serialiseArray(value, field.arrayType, field.mode)
    : serialise(value, field.type, field.mode);
