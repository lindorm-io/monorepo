import { isArray, isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { CaseCallback } from "../../types";
import { convertObjectArrayKeys } from "./convert-object-array-keys";

export const convertObjectKeys = <T = any>(input: T, callback: CaseCallback): T => {
  if (!isObject(input)) {
    throw new Error(`Invalid input [ ${typeof input} ]`);
  }

  const result: Dict = {};

  for (const [key, value] of Object.entries(input)) {
    if (isObject(value)) {
      result[callback(key)] = convertObjectKeys(value, callback);
    } else if (isArray(value)) {
      result[callback(key)] = convertObjectArrayKeys(value, callback);
    } else {
      result[callback(key)] = value;
    }
  }

  return result as T;
};
