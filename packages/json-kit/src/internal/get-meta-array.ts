import { isArray, isObject } from "@lindorm/is";
import { getMetaObject } from "./get-meta-object.js";
import { getMetaType } from "./get-meta-type.js";

export const getMetaArray = (input: Array<any>): Array<string> => {
  const result: Array<any> = [];

  for (const value of input) {
    if (isObject(value)) {
      result.push(getMetaObject(value));
    } else if (isArray(value)) {
      result.push(getMetaArray(value));
    } else {
      result.push(getMetaType(value));
    }
  }

  return result as Array<string>;
};
