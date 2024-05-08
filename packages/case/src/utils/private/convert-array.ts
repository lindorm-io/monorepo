import { isArray, isString } from "@lindorm/is";
import { CaseCallback } from "../../types";

export const convertArray = (input: Array<string>, callback: CaseCallback): Array<string> => {
  if (!isArray(input)) {
    throw new Error(`Invalid input [ ${typeof input} ]`);
  }

  const result: Array<string> = [];

  for (const value of input) {
    if (isString(value)) {
      result.push(callback(value));
    } else {
      result.push(value);
    }
  }

  return result;
};
