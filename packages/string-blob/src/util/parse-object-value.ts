import { MetaType } from "../enum";
import { isObject } from "@lindorm-io/core";
import { parseArrayValue } from "./parse-array-value";
import { parseErrorValue } from "./parse-error-value";

export const parseObjectValue = (
  json: Record<string, any>,
  meta: Record<string, any>,
): Record<string, any> => {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(json)) {
    if (isObject(meta[key])) {
      result[key] = parseObjectValue(json[key], meta[key]);
    } else if (Array.isArray(meta[key])) {
      result[key] = parseArrayValue(json[key], meta[key]);
    } else if (meta[key] === MetaType.BOOLEAN) {
      result[key] = JSON.parse(value);
    } else if (meta[key] === MetaType.DATE) {
      result[key] = new Date(value);
    } else if (meta[key] === MetaType.ERROR) {
      result[key] = parseErrorValue(value);
    } else if (meta[key] === MetaType.NUMBER) {
      result[key] = parseInt(value, 10);
    } else if (meta[key] === MetaType.STRING) {
      result[key] = typeof value === "string" ? value : JSON.parse(value);
    } else if (meta[key] === MetaType.NULL) {
      result[key] = null;
    } else if (meta[key] === MetaType.UNDEFINED) {
      result[key] = undefined;
    }
  }

  return result;
};
