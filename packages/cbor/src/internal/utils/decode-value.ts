import { B64 } from "@lindorm/b64";
import { isNumber, isString } from "@lindorm/is";
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

    case "array":
      return wire as Array<unknown>;

    case "date":
      return new Date((wire as number) * 1000);

    // ⚠ `wire` is read straight off the record and used as an index key, so a
    // tstr code must never reach the lookup: see `resolve-cbor-spec.ts` for what
    // an index read resolves on a prototype-carrying map. The result must BE a
    // domain string, not merely defined.
    case "enum": {
      const value = isNumber(wire) ? field.reverseEnum![wire] : undefined;

      if (isString(value)) return value;

      throw new CborError("Unknown enum wire code", {
        code: "unknown_enum_int",
        title: "Unknown Enum Wire Code",
        details: `Field "${field.key}" received wire code ${String(wire)}, which is not defined in its enum map.`,
      });
    }

    case "bstr":
      return decodeBstr(field, wire);

    case "bstrArray":
      return (wire as Array<unknown>).map((item) => decodeBstr(field, item));

    // ⚠ A bespoke decoder receives the WIRE value and owns whatever it builds
    // from it. Assembling an object with `result[key] = …` off keys the wire
    // chose re-opens what `decode-cbor-map.ts` closes: a `"__proto__"` key
    // invokes the prototype setter, so the member is dropped and the record
    // picks the result's prototype. Use `Object.defineProperty` /
    // `Object.fromEntries` there too.
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
