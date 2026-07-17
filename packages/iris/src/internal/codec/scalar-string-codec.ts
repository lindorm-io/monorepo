import { IrisSerializationError } from "../../errors/IrisSerializationError.js";
import type { EnvelopeFieldSpec, ScalarValue } from "./envelope-field-table.js";

/**
 * Encode a scalar to its wire string. Shared by every string-valued transport:
 * kafka headers, redis hash fields, rabbit `x-iris-*` headers.
 */
export const encodeScalarToString = (spec: EnvelopeFieldSpec, value: unknown): string => {
  switch (spec.kind) {
    case "string":
      return String(value ?? "");
    case "int":
    case "float":
    case "bool":
      return String(value);
    case "nullable-int":
      return value === null || value === undefined ? "" : String(value);
    case "nullable-string":
      return (value as string | null) ?? "";
    default:
      throw new IrisSerializationError(`Unsupported wire kind "${spec.kind as string}"`, {
        code: "unsupported_wire_kind",
        title: "Unsupported Wire Kind",
        details:
          "The envelope field table declared a wire kind the string codec does not handle. This is an internal invariant violation.",
        data: { field: spec.key, kind: spec.kind },
      });
  }
};

/**
 * Decode a scalar from its wire string. `undefined` (field absent from the wire)
 * yields the field's declared default; an empty string decodes to `null` for
 * nullable fields, matching the encode side.
 */
export const decodeScalarFromString = (
  spec: EnvelopeFieldSpec,
  raw: string | undefined,
): ScalarValue => {
  if (raw === undefined) return spec.default;

  switch (spec.kind) {
    case "string":
      return raw;
    case "int":
      return parseInt(raw, 10);
    case "float":
      return parseFloat(raw);
    case "bool":
      return raw === "true";
    case "nullable-int":
      return raw === "" ? null : parseInt(raw, 10);
    case "nullable-string":
      return raw === "" ? null : raw;
    default:
      throw new IrisSerializationError(`Unsupported wire kind "${spec.kind as string}"`, {
        code: "unsupported_wire_kind",
        title: "Unsupported Wire Kind",
        details:
          "The envelope field table declared a wire kind the string codec does not handle. This is an internal invariant violation.",
        data: { field: spec.key, kind: spec.kind },
      });
  }
};
