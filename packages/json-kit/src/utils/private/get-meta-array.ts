import { isArray, isObject } from "@lindorm/is";
import { _getMetaObject } from "./get-meta-object";
import { _getMetaType } from "./get-meta-type";

export const _getMetaArray = (input: Array<any>): Array<string> => {
  const result: Array<any> = [];

  for (const value of input) {
    if (isObject(value)) {
      result.push(_getMetaObject(value));
    } else if (isArray(value)) {
      result.push(_getMetaArray(value));
    } else {
      result.push(_getMetaType(value));
    }
  }

  return result;
};
