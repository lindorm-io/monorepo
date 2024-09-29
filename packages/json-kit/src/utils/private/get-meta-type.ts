import {
  isArray,
  isBoolean,
  isDate,
  isFinite,
  isNull,
  isString,
  isUndefined,
} from "@lindorm/is";
import { MetaType } from "../../enums/private/MetaType";

export const getMetaType = (value: any): string => {
  if (isDate(value)) return MetaType.Date;
  if (isArray(value)) return MetaType.Array;
  if (isBoolean(value)) return MetaType.Boolean;
  if (isNull(value)) return MetaType.Null;
  if (isFinite(value)) return MetaType.Number;
  if (isString(value)) return MetaType.String;
  if (isUndefined(value)) return MetaType.Undefined;

  return MetaType.Unknown;
};
