import { parseObjectValue } from "./parse-object-value";

export const parseBlob = (string: string): Record<string, any> => {
  const { json, meta } = JSON.parse(string);

  return parseObjectValue(json, meta);
};
