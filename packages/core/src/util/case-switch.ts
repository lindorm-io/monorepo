import { camelCase, snakeCase } from "lodash";
import { convertArrayValues, convertObjectKeys } from "./convert";

export const camelArray = (input: Array<string>): Array<string> =>
  convertArrayValues(input, camelCase);

export const camelKeys = <Output extends Record<string, any>>(input: Record<string, any>): Output =>
  convertObjectKeys<Output>(input, camelCase);

export const pascalCase = (string: string): string => {
  const [first, ...rest] = camelCase(string);
  return first.toUpperCase().concat(...rest);
};

export const pascalArray = (input: Array<string>): Array<string> =>
  convertArrayValues(input, pascalCase);

export const pascalKeys = <Output extends Record<string, any>>(
  input: Record<string, any>,
): Output => convertObjectKeys<Output>(input, pascalCase);

export const snakeArray = (input: Array<string>): Array<string> =>
  convertArrayValues(input, snakeCase);

export const snakeKeys = <Output extends Record<string, any>>(input: Record<string, any>): Output =>
  convertObjectKeys<Output>(input, snakeCase);
