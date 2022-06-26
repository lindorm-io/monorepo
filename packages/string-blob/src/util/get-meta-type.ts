import { MetaType } from "../enum";
import {
  isArray,
  isBoolean,
  isDate,
  isError,
  isNull,
  isNumber,
  isString,
  isUndefined,
} from "lodash";

export const getMetaType = (value: any): string => {
  if (isArray(value)) return MetaType.ARRAY;
  if (isBoolean(value)) return MetaType.BOOLEAN;
  if (isDate(value)) return MetaType.DATE;
  if (isError(value)) return MetaType.ERROR;
  if (isNull(value)) return MetaType.NULL;
  if (isNumber(value)) return MetaType.NUMBER;
  if (isString(value)) return MetaType.STRING;
  if (isUndefined(value)) return MetaType.UNDEFINED;

  return MetaType.UNKNOWN;
};
