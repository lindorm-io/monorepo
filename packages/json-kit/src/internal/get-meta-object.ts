import { isArray, isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { getMetaArray } from "./get-meta-array.js";
import { getMetaType } from "./get-meta-type.js";

export const getMetaObject = (input: Dict): Dict<string> => {
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
