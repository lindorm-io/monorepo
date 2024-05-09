import { isArray, isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { _MetaType } from "../../enums/private/MetaType";
import { _parseObjectValues } from "./parse-object-values";

export const _parseArrayValues = (input: any, meta: Dict): Array<any> => {
  const parsed = isArray(input) ? input : JSON.parse(input);
  const result: Array<any> = [];

  for (const [index, value] of parsed.entries()) {
    if (isObject(meta[index])) {
      result.push(_parseObjectValues(value, meta[index]));
    } else if (isArray(meta[index])) {
      result.push(_parseArrayValues(value, meta[index]));
    } else if (meta[index] === _MetaType.Boolean) {
      result.push(JSON.parse(value));
    } else if (meta[index] === _MetaType.Date) {
      result.push(new Date(value));
    } else if (meta[index] === _MetaType.Number) {
      result.push(parseInt(value, 10));
    } else if (meta[index] === _MetaType.String) {
      result.push(value);
    } else if (meta[index] === _MetaType.Null) {
      result.push(null);
    } else if (meta[index] === _MetaType.Undefined) {
      result.push(undefined);
    } else {
      result.push(JSON.parse(value));
    }
  }

  return result;
};
