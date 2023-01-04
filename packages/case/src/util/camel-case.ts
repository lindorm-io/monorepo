import { CaseInput } from "../types";
import { camelCase as _camelCase, isArray, isString } from "lodash";
import { convertArrayValues, convertObjectKeys } from "./convert";
import { isObjectStrict } from "./is-object-strict";

const camelArray = (input: Array<string>): Array<string> => convertArrayValues(input, _camelCase);

const camelKeys = <Output extends Record<string, any>>(input: Record<string, any>): Output =>
  convertObjectKeys<Output>(input, _camelCase);

export const camelCase = <T = any>(input: CaseInput): T => {
  if (isObjectStrict(input)) {
    return camelKeys<T>(input);
  }
  if (isArray(input)) {
    return camelArray(input) as unknown as T;
  }
  if (isString(input)) {
    return _camelCase(input) as unknown as T;
  }
  throw new Error(`Invalid type [ ${typeof input} ]`);
};
