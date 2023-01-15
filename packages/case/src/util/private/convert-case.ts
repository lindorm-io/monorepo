import { CaseCallback, CaseInput } from "../../types";
import { convertArrayValues } from "./convert-array-values";
import { convertObjectKeys } from "./convert-object-keys";
import { isObject } from "@lindorm-io/core";

export const convertCase = <T = any>(input: CaseInput, callback: CaseCallback): T => {
  if (isObject(input)) {
    return convertObjectKeys<T>(input, callback);
  }
  if (Array.isArray(input)) {
    return convertArrayValues(input, callback) as unknown as T;
  }
  if (typeof input === "string") {
    return callback(input) as unknown as T;
  }
  throw new Error(`Invalid type [ ${typeof input} ]`);
};
