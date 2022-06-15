import { isUndefined } from "lodash";

export const removeUndefinedFromArray = <Input extends Array<any>, Output extends Array<any>>(
  input: Input,
): Output => {
  const result: Array<any> = [];

  for (const value of input) {
    if (isUndefined(value)) continue;
    result.push(value);
  }

  return result as Output;
};

export const removeUndefinedFromObject = <
  Input extends Record<string, any>,
  Output extends Record<string, any>,
>(
  input: Input,
): Output => {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(input)) {
    if (isUndefined(value)) continue;
    result[key] = value;
  }

  return result as Output;
};
