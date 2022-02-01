import { isArray, isDate, isError, isObject, isString, isUndefined } from "lodash";

export const isArrayStrict = (input: unknown): input is Array<unknown> => {
  return isArray(input) && !isString(input) && !isUndefined(input);
};

export const isObjectStrict = (input: unknown): input is Record<string, unknown> => {
  return isObject(input) && !isArray(input) && !isDate(input) && !isError(input);
};
