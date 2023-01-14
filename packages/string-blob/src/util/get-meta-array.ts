import { getMetaObject } from "./get-meta-object";
import { getMetaType } from "./get-meta-type";
import { isObject } from "@lindorm-io/core";

export const getMetaArray = (input: Array<any>): Array<string> => {
  const result: Array<any> = [];

  for (const value of input) {
    if (isObject(value)) {
      result.push(getMetaObject(value));
    } else if (Array.isArray(value)) {
      result.push(getMetaArray(value));
    } else {
      result.push(getMetaType(value));
    }
  }

  return result;
};
