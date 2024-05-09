import { isArray, isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { _getMetaArray } from "./get-meta-array";
import { _getMetaType } from "./get-meta-type";

export const _getMetaObject = (input: Dict): Record<string, string> => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(input)) {
    if (isObject(value)) {
      result[key] = _getMetaObject(value);
    } else if (isArray(value)) {
      result[key] = _getMetaArray(value);
    } else {
      result[key] = _getMetaType(value);
    }
  }

  return result;
};
