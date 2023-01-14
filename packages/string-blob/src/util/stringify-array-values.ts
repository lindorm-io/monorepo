import { isObject } from "@lindorm-io/core";
import { stringifyObjectValues } from "./stringify-object-values";

export const stringifyArrayValues = (input: Array<any>): Array<any> => {
  const result: Array<any> = [];

  for (const value of input) {
    if (isObject(value)) {
      result.push(stringifyObjectValues(value));
    } else if (Array.isArray(value)) {
      result.push(stringifyArrayValues(value));
    } else if (value instanceof Date) {
      result.push(value.toJSON());
    } else if (value instanceof Error) {
      result.push(JSON.stringify(value, Object.getOwnPropertyNames(value)));
    } else if (typeof value === "string") {
      result.push(value);
    } else if (value === null) {
      result.push("null");
    } else if (value === undefined) {
      result.push("undefined");
    } else {
      result.push(JSON.stringify(value));
    }
  }

  return result;
};
