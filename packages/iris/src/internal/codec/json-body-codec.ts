import type { ScalarFields, ScalarFieldKey } from "./envelope-field-table.js";
import { ENVELOPE_FIELD_TABLE } from "./envelope-field-table.js";
import { decodeScalarFromJson } from "./scalar-json-codec.js";

/**
 * JSON-body adapter — scalars ⇄ a plain object whose values keep their native
 * JSON type (numbers stay numbers, booleans stay booleans, `expiry` stays
 * `number | null`). Used by NATS, which ships the whole envelope as one JSON
 * document. Encode is the identity over the typed values; the object is built
 * in table order so serialized bytes stay stable.
 */

/** Project scalars into a JSON object (typed values, table order). */
export const encodeScalarJson = (scalars: ScalarFields): Record<string, unknown> => {
  const obj: Record<string, unknown> = {};
  for (const spec of ENVELOPE_FIELD_TABLE) {
    obj[spec.key] = scalars[spec.key];
  }
  return obj;
};

/** Decode scalars from a parsed JSON object (absent fields → defaults). */
export const decodeScalarJson = (json: Record<string, unknown>): ScalarFields => {
  const out = {} as Record<ScalarFieldKey, unknown>;
  for (const spec of ENVELOPE_FIELD_TABLE) {
    out[spec.key] = decodeScalarFromJson(spec, json[spec.key]);
  }
  return out as ScalarFields;
};
