import { isArray, isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { MetaType } from "../../enums/private";
import { parseArrayValues } from "./parse-array-values";

export const parseObjectValues = (dict: Dict, meta: Dict): Dict => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(dict)) {
    if (isObject(meta[key])) {
      result[key] = parseObjectValues(dict[key], meta[key]);
    } else if (isArray(meta[key])) {
      result[key] = parseArrayValues(dict[key], meta[key]);
    } else if (meta[key] === MetaType.Boolean) {
      result[key] = JSON.parse(value);
    } else if (meta[key] === MetaType.Date) {
      result[key] = new Date(value);
    } else if (meta[key] === MetaType.Number) {
      result[key] = parseInt(value, 10);
    } else if (meta[key] === MetaType.String) {
      result[key] = value;
    } else if (meta[key] === MetaType.Null) {
      result[key] = null;
    } else if (meta[key] === MetaType.Undefined) {
      result[key] = undefined;
    } else {
      result[key] = JSON.parse(value);
    }
  }

  return result;
};
