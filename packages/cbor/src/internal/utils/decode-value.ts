import { B64 } from "@lindorm/b64";
import { CborError } from "../../errors/index.js";
import type { ResolvedCborField } from "../types/resolved-cbor-spec.js";

const decodeBstr = (field: ResolvedCborField, wire: unknown): Buffer | string => {
  const bytes = wire as Uint8Array;

  return field.encoding
    ? B64.encode(Buffer.from(bytes), field.encoding)
    : Buffer.from(bytes);
};

export const decodeValue = (field: ResolvedCborField, wire: unknown): unknown => {
  switch (field.kind) {
    case "text":
      return String(wire);

    case "int":
      return wire as number;

    case "bool":
      return wire as boolean;

    case "date":
      return new Date((wire as number) * 1000);

    case "enum": {
      const value = field.reverseEnum![wire as number];

      if (value === undefined) {
        throw new CborError("Unknown enum wire code", {
          code: "unknown_enum_int",
          title: "Unknown Enum Wire Code",
          details: `Field "${field.key}" received wire code ${String(wire)}, which is not defined in its enum map.`,
        });
      }

      return value;
    }

    case "bstr":
      return decodeBstr(field, wire);

    case "bstrArray":
      return (wire as Array<unknown>).map((item) => decodeBstr(field, item));

    case "bespoke":
      return field.decode!(wire);

    default:
      throw new CborError("Unknown value kind", {
        code: "unknown_value_kind",
        title: "Unknown Value Kind",
        details: `Field "${field.key}" has an unsupported kind "${field.kind as string}".`,
      });
  }
};
