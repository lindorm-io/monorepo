import { parseArrayValue } from "./parse-array-value";
import { parseObjectValue } from "./parse-object-value";

export const parseBlob = <T = Record<string, any>>(input: any): T => {
  const { json, meta } = JSON.parse(typeof input === "string" ? input : JSON.stringify(input));

  return Array.isArray(json)
    ? (parseArrayValue(json, meta) as unknown as T)
    : (parseObjectValue(json, meta) as unknown as T);
};
