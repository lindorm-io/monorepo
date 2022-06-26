import { isArray, isDate, isError, isObject } from "lodash";

export const isObjectStrict = (input: unknown): input is Record<string, unknown> =>
  isObject(input) && !isArray(input) && !isDate(input) && !isError(input);
