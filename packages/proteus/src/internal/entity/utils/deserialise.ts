import { isBoolean, isNumber, isString } from "@lindorm/is";
import { Primitive } from "@lindorm/json-kit";
import { ProteusError } from "../../../errors/index.js";
import type { MetaFieldMode, MetaFieldType } from "../types/metadata.js";
import { decimalFitsDouble } from "./decimal-fidelity.js";

export const deserialise = (
  value: any,
  type: MetaFieldType | null,
  mode?: MetaFieldMode | null,
): any => {
  switch (type) {
    case "bigint": {
      if (typeof value === "bigint") return value;
      if (value == null) return null;
      return BigInt(value);
    }

    case "boolean": {
      if (isBoolean(value)) return value;
      if (isString(value)) return value === "true";
      return Boolean(value);
    }

    case "date":
    case "timestamp": {
      if (value instanceof Date) {
        if (isNaN(value.getTime())) {
          throw new ProteusError("Invalid Date object during deserialisation", {
            code: "deserialise_failed",
            title: "Deserialise Failed",
            details: `A "${type}" field received a Date object representing an invalid time (NaN); ensure the stored value is a valid date.`,
            data: { type },
            debug: { value: String(value) },
          });
        }
        return value;
      }
      if (value == null) return value;
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new ProteusError("Cannot convert value to date during deserialisation", {
          code: "deserialise_failed",
          title: "Deserialise Failed",
          details: `A "${type}" field received a value that cannot be parsed into a valid Date; ensure the stored value is a date string or timestamp.`,
          data: { type },
          debug: { value: String(value) },
        });
      }
      return date;
    }

    case "real":
    case "float": {
      if (isNumber(value)) return value;
      if (value == null) return null;
      const parsed = parseFloat(value);
      if (isNaN(parsed)) {
        throw new ProteusError("Cannot convert value to float during deserialisation", {
          code: "deserialise_failed",
          title: "Deserialise Failed",
          details: `A "${type}" field received a value that cannot be parsed into a floating-point number; ensure the stored value is numeric.`,
          data: { type },
          debug: { value: String(value) },
        });
      }
      return parsed;
    }

    case "smallint":
    case "integer": {
      if (isNumber(value)) {
        if (Number.isInteger(value)) return value;
        return Math.trunc(value);
      }
      if (value == null) return null;
      const parsed = parseInt(value, 10);
      if (isNaN(parsed)) {
        throw new ProteusError("Cannot convert value to integer during deserialisation", {
          code: "deserialise_failed",
          title: "Deserialise Failed",
          details: `A "${type}" field received a value that cannot be parsed into an integer; ensure the stored value is numeric.`,
          data: { type },
          debug: { value: String(value) },
        });
      }
      return parsed;
    }

    case "decimal": {
      if (value == null) return null;

      // Exact, arbitrary-precision mode: the canonical JS type is `string`
      // (e.g. money). node-postgres/mysql already return NUMERIC as a string.
      if (mode === "string") {
        return isString(value) ? value : String(value);
      }

      // Default mode: the canonical JS type is `number`. A JS number is always a
      // valid double, so it passes straight through. A string (the driver's raw
      // NUMERIC, or caller-supplied input) is accepted only when it round-trips
      // through a double without precision loss — otherwise we throw rather than
      // silently truncate. Use `@Field("decimal", { mode: "string" })` for values
      // that exceed JS number precision.
      if (isNumber(value)) return value;

      const str = String(value);
      const num = Number(str);
      if (!Number.isFinite(num) || !decimalFitsDouble(str)) {
        throw new ProteusError(
          "Decimal value exceeds JS number precision during deserialisation",
          {
            code: "deserialise_failed",
            title: "Deserialise Failed",
            details: `The decimal value "${str}" cannot be represented as a JS number without precision loss. Declare the field with \`@Field("decimal", { mode: "string" })\` to read it as an exact string.`,
            data: { type },
            debug: { value: str },
          },
        );
      }
      return num;
    }

    case "binary": {
      if (value == null) return null;
      return Buffer.isBuffer(value) ? value : Buffer.from(value);
    }

    case "array":
    case "object":
    case "json": {
      if (isString(value)) {
        try {
          return new Primitive(value).toJSON();
        } catch {
          return JSON.parse(value);
        }
      }
      return value;
    }

    default:
      return value;
  }
};
