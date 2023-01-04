import { CaseInput } from "../types";
import { convertArrayValues, convertObjectKeys } from "./convert";
import { isArray, isString, kebabCase as _kebabCase } from "lodash";
import { isObjectStrict } from "./is-object-strict";

const kebabArray = (input: Array<string>): Array<string> => convertArrayValues(input, _kebabCase);

const kebabKeys = <Output extends Record<string, any>>(input: Record<string, any>): Output =>
  convertObjectKeys<Output>(input, _kebabCase);

export const kebabCase = <T = any>(input: CaseInput): T => {
  if (isObjectStrict(input)) {
    return kebabKeys<T>(input);
  }
  if (isArray(input)) {
    return kebabArray(input) as unknown as T;
  }
  if (isString(input)) {
    return _kebabCase(input) as unknown as T;
  }
  throw new Error(`Invalid type [ ${typeof input} ]`);
};
