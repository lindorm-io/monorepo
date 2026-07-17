import { IrisSerializationError } from "../../errors/IrisSerializationError.js";
import type { EnvelopeFieldSpec, ScalarValue } from "./envelope-field-table.js";

/**
 * Decode a scalar from a parsed-JSON value. Used by the `json-body` (nats)
 * adapter where values keep their native JSON type — the encode side is the
 * identity (the typed envelope value goes straight into the JSON object), so
 * only a decode is needed here.
 */
export const decodeScalarFromJson = (
  spec: EnvelopeFieldSpec,
  raw: unknown,
): ScalarValue => {
  switch (spec.kind) {
    case "string":
      return (raw as string | null | undefined) ?? spec.default;
    case "int":
    case "float":
      return (raw as number | null | undefined) ?? spec.default;
    case "bool":
      return raw === true;
    case "nullable-int":
      return (raw as number | null | undefined) ?? null;
    case "nullable-string":
      return (raw as string | null | undefined) || null;
    default:
      throw new IrisSerializationError(`Unsupported wire kind "${spec.kind as string}"`, {
        code: "unsupported_wire_kind",
        title: "Unsupported Wire Kind",
        details:
          "The envelope field table declared a wire kind the JSON codec does not handle. This is an internal invariant violation.",
        data: { field: spec.key, kind: spec.kind },
      });
  }
};
