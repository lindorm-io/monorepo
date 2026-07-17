import type {
  EnvelopeFieldSpec,
  ScalarFields,
  ScalarFieldKey,
} from "./envelope-field-table.js";
import { ENVELOPE_FIELD_TABLE } from "./envelope-field-table.js";
import { decodeScalarFromString, encodeScalarToString } from "./scalar-string-codec.js";

/**
 * Header-map adapter — scalars ⇄ a flat `x-iris-*` string→string map. Used by
 * Kafka (message headers) and, over a subset of the table, by RabbitMQ.
 */

/** Encode the given specs (default: the whole table) into an `x-iris-*` map. */
export const encodeScalarHeaders = (
  scalars: ScalarFields,
  specs: ReadonlyArray<EnvelopeFieldSpec> = ENVELOPE_FIELD_TABLE,
): Record<string, string> => {
  const headers: Record<string, string> = {};
  for (const spec of specs) {
    headers[spec.header] = encodeScalarToString(spec, scalars[spec.key]);
  }
  return headers;
};

/**
 * Decode scalars from a header lookup. Always walks the full table, so absent
 * headers fall back to their declared defaults; callers that carry a field in a
 * native slot (rabbit: topic/priority/timestamp) override it after decoding.
 */
export const decodeScalarHeaders = (
  read: (header: string) => string | undefined,
): ScalarFields => {
  const out = {} as Record<ScalarFieldKey, unknown>;
  for (const spec of ENVELOPE_FIELD_TABLE) {
    out[spec.key] = decodeScalarFromString(spec, read(spec.header));
  }
  return out as ScalarFields;
};
