import type { ScalarFields, ScalarFieldKey } from "./envelope-field-table.js";
import { ENVELOPE_FIELD_TABLE } from "./envelope-field-table.js";
import { decodeScalarFromString, encodeScalarToString } from "./scalar-string-codec.js";

/**
 * Flat-hash adapter — scalars ⇄ a flat `[field, value, field, value, …]` array
 * of strings. Used by Redis streams (`XADD` field/value pairs). Keyed by the
 * bare envelope field name (`topic`, `attempt`, …), not the `x-iris-*` header.
 */

/** Encode scalars as a flat field/value string array in table order. */
export const encodeScalarFields = (scalars: ScalarFields): Array<string> => {
  const fields: Array<string> = [];
  for (const spec of ENVELOPE_FIELD_TABLE) {
    fields.push(spec.key, encodeScalarToString(spec, scalars[spec.key]));
  }
  return fields;
};

/** Decode scalars from a `field → value` map (absent fields → defaults). */
export const decodeScalarFieldsFromMap = (map: Map<string, string>): ScalarFields => {
  const out = {} as Record<ScalarFieldKey, unknown>;
  for (const spec of ENVELOPE_FIELD_TABLE) {
    out[spec.key] = decodeScalarFromString(spec, map.get(spec.key));
  }
  return out as ScalarFields;
};
