import { camelCase, snakeCase } from "lodash";
import { isArrayStrict, isObjectStrict } from "./strict-type";

type Callback = (arg: string) => string;

const convertArrayValuesTo = (input: Array<string>, callback: Callback): Array<string> => {
  if (!isArrayStrict(input)) {
    throw new Error(`Invalid input [ ${typeof input} ]`);
  }

  const result: Array<string> = [];

  for (const value of input) {
    result.push(callback(value));
  }

  return result;
};

const convertObjectKeysTo = <Input extends Record<string, any>, Output extends Record<string, any>>(
  input: Input,
  callback: Callback,
): Output => {
  if (!isObjectStrict(input)) {
    throw new Error(`Invalid input [ ${typeof input} ]`);
  }

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(input)) {
    if (isObjectStrict(value)) {
      result[callback(key)] = convertObjectKeysTo(value, callback);
    } else {
      result[callback(key)] = value;
    }
  }

  return result as Output;
};

export const camelArray = (input: Array<string>): Array<string> => {
  return convertArrayValuesTo(input, camelCase);
};

export const camelKeys = <Input extends Record<string, any>, Output extends Record<string, any>>(
  input: Input,
): Output => {
  return convertObjectKeysTo<Input, Output>(input, camelCase);
};

export const pascalCase = (string: string): string => {
  const [first, ...rest] = camelCase(string);
  return first.toUpperCase().concat(...rest);
};

export const pascalArray = (input: Array<string>): Array<string> => {
  return convertArrayValuesTo(input, pascalCase);
};

export const pascalKeys = <Input extends Record<string, any>, Output extends Record<string, any>>(
  input: Input,
): Output => {
  return convertObjectKeysTo<Input, Output>(input, pascalCase);
};

export const snakeArray = (input: Array<string>): Array<string> => {
  return convertArrayValuesTo(input, snakeCase);
};

export const snakeKeys = <Input extends Record<string, any>, Output extends Record<string, any>>(
  input: Input,
): Output => {
  return convertObjectKeysTo<Input, Output>(input, snakeCase);
};
