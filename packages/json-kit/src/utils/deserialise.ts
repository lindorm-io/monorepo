import { Primitive } from "../classes/Primitive";

export const deserialise = (value: any, type: string | null): any => {
  switch (type) {
    case "bigint": {
      if (typeof value === "bigint") return value;
      if (value == null) return BigInt(0);
      return BigInt(value);
    }

    case "boolean": {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") return value === "true";
      return Boolean(value);
    }

    case "date": {
      if (value instanceof Date) {
        if (isNaN(value.getTime())) {
          throw new Error("Invalid Date object");
        }
        return value;
      }
      if (value == null) return value;
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error("Cannot convert value to date");
      }
      return date;
    }

    case "float": {
      if (typeof value === "number") return value;
      if (value == null) return 0;
      const parsed = parseFloat(value);
      if (isNaN(parsed)) {
        throw new Error("Cannot convert value to float");
      }
      return parsed;
    }

    case "integer": {
      if (typeof value === "number") {
        if (Number.isInteger(value)) return value;
        return Math.trunc(value);
      }
      if (value == null) return 0;
      const parsed = parseInt(value, 10);
      if (isNaN(parsed)) {
        throw new Error("Cannot convert value to integer");
      }
      return parsed;
    }

    case "array":
    case "object": {
      if (typeof value === "string") {
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
