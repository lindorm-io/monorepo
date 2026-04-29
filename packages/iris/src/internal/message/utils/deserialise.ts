import { isBoolean, isNumber, isString } from "@lindorm/is";
import { IrisSerializationError } from "../../../errors/IrisSerializationError.js";
import type { MetaFieldType } from "../types/types.js";

export const deserialise = (value: any, type: MetaFieldType): any => {
  switch (type) {
    case "bigint": {
      if (typeof value === "bigint") return value;
      if (value == null) return null;
      try {
        return BigInt(value);
      } catch {
        throw new IrisSerializationError(
          "Cannot convert value to bigint during deserialisation",
          {
            debug: { type, value: String(value) },
          },
        );
      }
    }

    case "boolean": {
      if (value == null) return null;
      if (isBoolean(value)) return value;
      if (isString(value)) return value === "true";
      return Boolean(value);
    }

    case "date": {
      if (value instanceof Date) {
        if (isNaN(value.getTime())) {
          throw new IrisSerializationError("Invalid Date object during deserialisation", {
            debug: { type, value: String(value) },
          });
        }
        return value;
      }
      if (value == null) return null;
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new IrisSerializationError(
          "Cannot convert value to date during deserialisation",
          {
            debug: { type, value: String(value) },
          },
        );
      }
      return date;
    }

    case "float": {
      if (isNumber(value)) return value;
      if (value == null) return null;
      const parsed = parseFloat(value);
      if (isNaN(parsed)) {
        throw new IrisSerializationError(
          "Cannot convert value to float during deserialisation",
          {
            debug: { type, value: String(value) },
          },
        );
      }
      return parsed;
    }

    case "integer": {
      if (isNumber(value)) {
        if (Number.isInteger(value)) return value;
        return Math.trunc(value);
      }
      if (value == null) return null;
      const parsed = parseInt(value, 10);
      if (isNaN(parsed)) {
        throw new IrisSerializationError(
          "Cannot convert value to integer during deserialisation",
          {
            debug: { type, value: String(value) },
          },
        );
      }
      return parsed;
    }

    case "array": {
      if (isString(value)) {
        try {
          return JSON.parse(value);
        } catch {
          throw new IrisSerializationError(
            "Failed to deserialise array value: invalid JSON",
            {
              debug: { type, value },
            },
          );
        }
      }
      return value;
    }

    case "object": {
      if (isString(value)) {
        try {
          return JSON.parse(value);
        } catch {
          throw new IrisSerializationError(
            "Failed to deserialise object value: invalid JSON",
            {
              debug: { type, value },
            },
          );
        }
      }
      return value;
    }

    case "email":
    case "string":
    case "url":
    case "uuid": {
      if (value == null) return null;
      return String(value);
    }

    case "enum": {
      return value;
    }

    default:
      return value;
  }
};
