import { isArray, isObject } from "@lindorm/is";
import { CaseCallback, KeysInput } from "../../types";
import { convertObjectArrayKeys } from "./convert-object-array-keys";
import { convertObjectKeys } from "./convert-object-keys";

export const convertObject = <T extends KeysInput = KeysInput>(
  input: T,
  callback: CaseCallback,
): T => {
  if (isObject(input)) {
    return convertObjectKeys<T>(input, callback);
  }
  if (isArray(input)) {
    return convertObjectArrayKeys<T>(input, callback);
  }
  throw new Error(`Invalid type [ ${typeof input} ]`);
};
