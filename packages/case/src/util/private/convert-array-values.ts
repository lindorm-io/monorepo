import { CaseCallback } from "../../types";

export const convertArrayValues = (input: Array<string>, callback: CaseCallback): Array<string> => {
  if (!Array.isArray(input)) {
    throw new Error(`Invalid input [ ${typeof input} ]`);
  }

  const result: Array<string> = [];

  for (const value of input) {
    result.push(callback(value));
  }

  return result;
};
