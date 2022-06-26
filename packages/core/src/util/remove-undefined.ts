import { isUndefined } from "lodash";

export const removeUndefinedFromArray = <Output extends Array<any>>(input: Array<any>): Output => {
  const result: Array<any> = [];

  for (const value of input) {
    if (isUndefined(value)) continue;
    result.push(value);
  }

  return result as Output;
};

export const removeUndefinedFromObject = <Output extends Record<string, any>>(
  input: Record<string, any>,
): Output => {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(input)) {
    if (isUndefined(value)) continue;
    result[key] = value;
  }

  return result as Output;
};
