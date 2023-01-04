import { CaseInput } from "../types";
import { camelCase, isArray, isString } from "lodash";
import { convertArrayValues, convertObjectKeys, isObjectStrict } from "./private";

const _pascalCase = (string: string): string => {
  const [first, ...rest] = camelCase(string);
  return first.toUpperCase().concat(...rest);
};

const pascalArray = (input: Array<string>): Array<string> => convertArrayValues(input, _pascalCase);

const pascalKeys = <Output extends Record<string, any>>(input: Record<string, any>): Output =>
  convertObjectKeys<Output>(input, _pascalCase);

export const pascalCase = <T = any>(input: CaseInput): T => {
  if (isObjectStrict(input)) {
    return pascalKeys<T>(input);
  }
  if (isArray(input)) {
    return pascalArray(input) as unknown as T;
  }
  if (isString(input)) {
    return _pascalCase(input) as unknown as T;
  }
  throw new Error(`Invalid type [ ${typeof input} ]`);
};
