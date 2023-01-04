import { CaseInput } from "../types";
import { convertArrayValues, convertObjectKeys } from "./convert";
import { isArray, isString, snakeCase as _snakeCase } from "lodash";
import { isObjectStrict } from "./is-object-strict";

const snakeArray = (input: Array<string>): Array<string> => convertArrayValues(input, _snakeCase);

const snakeKeys = <Output extends Record<string, any>>(input: Record<string, any>): Output =>
  convertObjectKeys<Output>(input, _snakeCase);

export const snakeCase = <T = any>(input: CaseInput): T => {
  if (isObjectStrict(input)) {
    return snakeKeys<T>(input);
  }
  if (isArray(input)) {
    return snakeArray(input) as unknown as T;
  }
  if (isString(input)) {
    return _snakeCase(input) as unknown as T;
  }
  throw new Error(`Invalid type [ ${typeof input} ]`);
};
