import { isArrayStrict } from "../strict-type";

type Callback = (arg: string) => string;

export const convertArrayValues = (input: Array<string>, callback: Callback): Array<string> => {
  if (!isArrayStrict(input)) {
    throw new Error(`Invalid input [ ${typeof input} ]`);
  }

  const result: Array<string> = [];

  for (const value of input) {
    result.push(callback(value));
  }

  return result;
};
