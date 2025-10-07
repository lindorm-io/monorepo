import { isArray, isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { MetaType } from "../../enums/private";
import { parseObjectValues } from "./parse-object-values";

export const parseArrayValues = (input: any, meta: Dict): Array<any> => {
  const parsed = isArray(input) ? input : (JSON.parse(input) as Array<any>);
  const result: Array<any> = [];

  for (const [index, val] of parsed.entries()) {
    if (isObject(meta[index])) {
      result.push(parseObjectValues(val, meta[index]));
    } else if (isArray(meta[index])) {
      result.push(parseArrayValues(val, meta[index]));
    } else if (meta[index] === MetaType.Boolean) {
      result.push(JSON.parse(val));
    } else if (meta[index] === MetaType.Date) {
      result.push(new Date(val));
    } else if (meta[index] === MetaType.Number) {
      result.push(parseInt(val, 10));
    } else if (meta[index] === MetaType.String) {
      result.push(val);
    } else if (meta[index] === MetaType.Null) {
      result.push(null);
    } else if (meta[index] === MetaType.Undefined) {
      result.push(undefined);
    } else if (meta[index] === MetaType.Buffer) {
      result.push(Buffer.from(val, "base64url"));
    } else {
      result.push(JSON.parse(val));
    }
  }

  return result;
};
