import { isArray } from "lodash";

type Callback = (arg: string) => string;

export const convertArrayValues = (input: Array<string>, callback: Callback): Array<string> => {
  if (!isArray(input)) {
    throw new Error(`Invalid input [ ${typeof input} ]`);
  }

  const result: Array<string> = [];

  for (const value of input) {
    result.push(callback(value));
  }

  return result;
};
