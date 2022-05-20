import { isArrayStrict } from "@lindorm-io/core";
import { isBoolean, isDate, isError, isNull, isNumber, isString, isUndefined } from "lodash";
import { MetaType } from "../enum";

export const getMetaType = (value: any): string => {
  if (isArrayStrict(value)) return MetaType.ARRAY;
  if (isBoolean(value)) return MetaType.BOOLEAN;
  if (isDate(value)) return MetaType.DATE;
  if (isError(value)) return MetaType.ERROR;
  if (isNull(value)) return MetaType.NULL;
  if (isNumber(value)) return MetaType.NUMBER;
  if (isString(value)) return MetaType.STRING;
  if (isUndefined(value)) return MetaType.UNDEFINED;

  return MetaType.UNKNOWN;
};
