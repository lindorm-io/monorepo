import { B64 } from "@lindorm/b64";
import { getUnixTime } from "@lindorm/date";
import { isDate } from "@lindorm/is";
import { CborError } from "../../errors/index.js";
import type { ResolvedCborField } from "../types/resolved-cbor-spec.js";

// A Buffer's `toJSON` makes cbor2 emit an object instead of a byte string, so the
// domain bytes MUST be normalised to a plain Uint8Array before they reach the encoder.
const encodeBstr = (field: ResolvedCborField, value: unknown): Uint8Array =>
  field.encoding
    ? new Uint8Array(B64.toBuffer(value as string, field.encoding))
    : new Uint8Array(value as Uint8Array);

export const encodeValue = (field: ResolvedCborField, value: unknown): unknown => {
  switch (field.kind) {
    case "text":
      return String(value);

    case "int":
      return value as number;

    case "bool":
      return value as boolean;

    case "date":
      return isDate(value) ? getUnixTime(value) : (value as number);

    case "enum": {
      const code = field.enum![value as string];

      if (code === undefined) {
        throw new CborError("Unknown enum value", {
          code: "unknown_enum_value",
          title: "Unknown Enum Value",
          details: `Field "${field.key}" received value "${String(value)}", which is not defined in its enum map.`,
        });
      }

      return code;
    }

    case "bstr":
      return encodeBstr(field, value);

    case "bstrArray":
      return (value as Array<unknown>).map((item) => encodeBstr(field, item));

    case "bespoke":
      return field.encode!(value);

    default:
      throw new CborError("Unknown value kind", {
        code: "unknown_value_kind",
        title: "Unknown Value Kind",
        details: `Field "${field.key}" has an unsupported kind "${field.kind as string}".`,
      });
  }
};
