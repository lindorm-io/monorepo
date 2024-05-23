import { isArray, isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { getMetaArray } from "./get-meta-array";
import { getMetaType } from "./get-meta-type";

export const getMetaObject = (input: Dict): Record<string, string> => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(input)) {
    if (isObject(value)) {
      result[key] = getMetaObject(value);
    } else if (isArray(value)) {
      result[key] = getMetaArray(value);
    } else {
      result[key] = getMetaType(value);
    }
  }

  return result;
};
