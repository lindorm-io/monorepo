import { convertObjectKeys } from "./convert-object-keys";
import { isArray } from "lodash";
import { isObjectStrict } from "../is-object-strict";

type Callback = (arg: string) => string;

export const convertArrayObjectKeys = (input: Array<any>, callback: Callback): Array<any> => {
  if (!isArray(input)) {
    throw new Error(`Invalid input [ ${typeof input} ]`);
  }

  const result: Array<any> = [];

  for (const item of input) {
    if (isObjectStrict(item)) {
      result.push(convertObjectKeys(item, callback));
    } else {
      result.push(item);
    }
  }

  return result;
};
