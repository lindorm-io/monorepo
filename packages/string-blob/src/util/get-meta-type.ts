import { isArrayStrict } from "@lindorm-io/core";
import { isBoolean, isDate, isError, isNull, isNumber, isString, isUndefined } from "lodash";

export const getMetaType = (value: any): string => {
  if (isArrayStrict(value)) return "array";
  if (isBoolean(value)) return "boolean";
  if (isDate(value)) return "date";
  if (isError(value)) return "error";
  if (isNull(value)) return "null";
  if (isNumber(value)) return "number";
  if (isString(value)) return "string";
  if (isUndefined(value)) return "undefined";

  return "unknown";
};
