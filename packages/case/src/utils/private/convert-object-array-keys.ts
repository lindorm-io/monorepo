import { isArray, isObject } from "@lindorm/is";
import { CaseCallback, KeysInput } from "../../types";
import { convertObjectKeys } from "./convert-object-keys";

export const convertObjectArrayKeys = <T extends KeysInput = KeysInput>(
  input: T,
  callback: CaseCallback,
): T => {
  if (!isArray(input)) {
    throw new Error(`Invalid input [ ${typeof input} ]`);
  }

  const result: Array<any> = [];

  for (const item of input) {
    if (isObject(item)) {
      result.push(convertObjectKeys(item, callback));
    } else if (isArray(item)) {
      result.push(convertObjectArrayKeys(item, callback));
    } else {
      result.push(item);
    }
  }

  return result as T;
};
