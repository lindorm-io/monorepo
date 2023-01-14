import { CaseCallback } from "../../types";
import { convertObjectKeys } from "./convert-object-keys";
import { isObject } from "./is-object";

export const convertArrayObjectKeys = (input: Array<any>, callback: CaseCallback): Array<any> => {
  if (!Array.isArray(input)) {
    throw new Error(`Invalid input [ ${typeof input} ]`);
  }

  const result: Array<any> = [];

  for (const item of input) {
    if (isObject(item)) {
      result.push(convertObjectKeys(item, callback));
    } else {
      result.push(item);
    }
  }

  return result;
};
