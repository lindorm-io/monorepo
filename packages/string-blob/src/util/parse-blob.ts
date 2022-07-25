import { parseObjectValue } from "./parse-object-value";

export const parseBlob = <T = Record<string, any>>(string: string): T => {
  const { json, meta } = JSON.parse(string);

  return parseObjectValue(json, meta) as T;
};
