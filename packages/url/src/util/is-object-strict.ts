import { isArray, isDate, isError, isObject } from "lodash";

export const isObjectStrict = (input: any): input is Record<string, any> =>
  isObject(input) && !isArray(input) && !isDate(input) && !isError(input);
