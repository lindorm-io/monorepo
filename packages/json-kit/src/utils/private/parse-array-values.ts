import { isArray, isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { MetaType } from "../../enums/private/MetaType";
import { parseObjectValues } from "./parse-object-values";

export const parseArrayValues = (input: any, meta: Dict): Array<any> => {
  const parsed = isArray(input) ? input : JSON.parse(input);
  const result: Array<any> = [];

  for (const [index, value] of parsed.entries()) {
    if (isObject(meta[index])) {
      result.push(parseObjectValues(value, meta[index]));
    } else if (isArray(meta[index])) {
      result.push(parseArrayValues(value, meta[index]));
    } else if (meta[index] === MetaType.Boolean) {
      result.push(JSON.parse(value));
    } else if (meta[index] === MetaType.Date) {
      result.push(new Date(value));
    } else if (meta[index] === MetaType.Number) {
      result.push(parseInt(value, 10));
    } else if (meta[index] === MetaType.String) {
      result.push(value);
    } else if (meta[index] === MetaType.Null) {
      result.push(null);
    } else if (meta[index] === MetaType.Undefined) {
      result.push(undefined);
    } else {
      result.push(JSON.parse(value));
    }
  }

  return result;
};
