import { Dict } from "@lindorm/types";

export const reverseDictValues = (dict: Dict<string>): Dict<string> => {
  const result: Dict<string> = {};
  for (const [key, value] of Object.entries(dict)) {
    result[value] = key;
  }
  return result;
};
