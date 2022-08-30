import { isArray, isString } from "lodash";
import { parseArrayValue } from "./parse-array-value";
import { parseObjectValue } from "./parse-object-value";

export const parseBlob = <T = Record<string, any>>(input: any): T => {
  const { json, meta } = JSON.parse(isString(input) ? input : JSON.stringify(input));

  return isArray(json)
    ? (parseArrayValue(json, meta) as unknown as T)
    : (parseObjectValue(json, meta) as unknown as T);
};
