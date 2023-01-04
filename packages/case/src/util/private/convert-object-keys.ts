import { isObjectStrict } from "./is-object-strict";
import { convertArrayObjectKeys } from "./convert-array-object-keys";
import { isArray } from "lodash";

type Callback = (arg: string) => string;

export const convertObjectKeys = <Output extends Record<string, any> = Record<string, any>>(
  input: Record<string, any>,
  callback: Callback,
): Output => {
  if (!isObjectStrict(input)) {
    throw new Error(`Invalid input [ ${typeof input} ]`);
  }

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(input)) {
    if (isObjectStrict(value)) {
      result[callback(key)] = convertObjectKeys(value, callback);
    } else if (isArray(value)) {
      result[callback(key)] = convertArrayObjectKeys(value, callback);
    } else {
      result[callback(key)] = value;
    }
  }

  return result as Output;
};
