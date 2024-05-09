import { isArray, isBoolean, isDate, isFinite, isNull, isString, isUndefined } from "@lindorm/is";
import { _MetaType } from "../../enums/private/MetaType";

export const _getMetaType = (value: any): string => {
  if (isArray(value)) return _MetaType.Array;
  if (isBoolean(value)) return _MetaType.Boolean;
  if (isDate(value)) return _MetaType.Date;
  if (isNull(value)) return _MetaType.Null;
  if (isFinite(value)) return _MetaType.Number;
  if (isString(value)) return _MetaType.String;
  if (isUndefined(value)) return _MetaType.Undefined;

  return _MetaType.Unknown;
};
