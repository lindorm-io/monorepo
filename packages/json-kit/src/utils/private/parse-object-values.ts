import { isArray, isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { _MetaType } from "../../enums/private/MetaType";
import { _parseArrayValues } from "./parse-array-values";

export const _parseObjectValues = (dict: Dict, meta: Dict): Dict => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(dict)) {
    if (isObject(meta[key])) {
      result[key] = _parseObjectValues(dict[key], meta[key]);
    } else if (isArray(meta[key])) {
      result[key] = _parseArrayValues(dict[key], meta[key]);
    } else if (meta[key] === _MetaType.Boolean) {
      result[key] = JSON.parse(value);
    } else if (meta[key] === _MetaType.Date) {
      result[key] = new Date(value);
    } else if (meta[key] === _MetaType.Number) {
      result[key] = parseInt(value, 10);
    } else if (meta[key] === _MetaType.String) {
      result[key] = value;
    } else if (meta[key] === _MetaType.Null) {
      result[key] = null;
    } else if (meta[key] === _MetaType.Undefined) {
      result[key] = undefined;
    } else {
      result[key] = JSON.parse(value);
    }
  }

  return result;
};
