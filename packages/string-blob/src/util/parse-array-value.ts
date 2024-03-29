import { MetaType } from "../enum";
import { isObject } from "@lindorm-io/core";
import { parseErrorValue } from "./parse-error-value";
import { parseObjectValue } from "./parse-object-value";

export const parseArrayValue = (input: any, meta: Record<string, any>): Array<any> => {
  const parsed = Array.isArray(input) ? input : JSON.parse(input);

  const result: Array<any> = [];

  for (const [index, value] of parsed.entries()) {
    if (isObject(meta[index])) {
      result.push(parseObjectValue(value, meta[index]));
    } else if (Array.isArray(meta[index])) {
      result.push(parseArrayValue(value, meta[index]));
    } else if (meta[index] === MetaType.BOOLEAN) {
      result.push(value === true || value === false ? value : JSON.parse(value));
    } else if (meta[index] === MetaType.DATE) {
      result.push(new Date(value));
    } else if (meta[index] === MetaType.ERROR) {
      result.push(parseErrorValue(value));
    } else if (meta[index] === MetaType.NUMBER) {
      result.push(parseInt(value, 10));
    } else if (meta[index] === MetaType.STRING) {
      result.push(value);
    } else if (meta[index] === MetaType.NULL) {
      result.push(null);
    } else if (meta[index] === MetaType.UNDEFINED) {
      result.push(undefined);
    }
  }

  return result;
};
