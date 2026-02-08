import {
  isArray,
  isBigInt,
  isBoolean,
  isBuffer,
  isDate,
  isFinite,
  isNull,
  isString,
  isUndefined,
} from "@lindorm/is";
import { MetaType } from "../../enums/private";

export const getMetaType = (value: any): string => {
  if (isDate(value)) return MetaType.Date;
  if (isArray(value)) return MetaType.Array;
  if (isBoolean(value)) return MetaType.Boolean;
  if (isNull(value)) return MetaType.Null;
  if (isBigInt(value)) return MetaType.BigInt;
  if (isFinite(value)) return MetaType.Number;
  if (isString(value)) return MetaType.String;
  if (isBuffer(value)) return MetaType.Buffer;
  if (isUndefined(value)) return MetaType.Undefined;

  return MetaType.Unknown;
};
