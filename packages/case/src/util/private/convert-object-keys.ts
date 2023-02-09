import { CaseCallback } from "../../types";
import { convertArrayObjectKeys } from "./convert-array-object-keys";
import { isObject } from "@lindorm-io/core";

export const convertObjectKeys = <Output = Record<string, any>>(
  input: Record<string, any>,
  callback: CaseCallback,
): Output => {
  if (!isObject(input)) {
    throw new Error(`Invalid input [ ${typeof input} ]`);
  }

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(input)) {
    if (isObject(value)) {
      result[callback(key)] = convertObjectKeys(value, callback);
    } else if (Array.isArray(value)) {
      result[callback(key)] = convertArrayObjectKeys(value, callback);
    } else {
      result[callback(key)] = value;
    }
  }

  return result as Output;
};
