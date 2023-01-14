import { isObject } from "@lindorm-io/core";
import { stringifyArrayValues } from "./stringify-array-values";

export const stringifyObjectValues = (input: Record<string, any>): Record<string, any> => {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(input)) {
    if (isObject(value)) {
      result[key] = stringifyObjectValues(value);
    } else if (Array.isArray(value)) {
      result[key] = stringifyArrayValues(value);
    } else if (value instanceof Date) {
      result[key] = value.toJSON();
    } else if (value instanceof Error) {
      result[key] = JSON.stringify(value, Object.getOwnPropertyNames(value));
    } else if (typeof value === "string") {
      result[key] = value;
    } else if (value === null) {
      result[key] = "null";
    } else if (value === undefined) {
      result[key] = "undefined";
    } else {
      result[key] = JSON.stringify(value);
    }
  }

  return result;
};
