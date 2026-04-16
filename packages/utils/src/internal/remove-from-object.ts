import { isArray, isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { removeFromArray } from "./remove-from-array";

type Predicate = (value: any) => boolean;

export const removeFromObject = <T extends Dict>(dict: T, predicate: Predicate): T => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(dict)) {
    if (isArray(value)) {
      result[key] = removeFromArray(value, predicate);
    } else if (isObject(value)) {
      result[key] = removeFromObject(value, predicate);
    } else if (predicate(value)) {
      continue;
    } else {
      result[key] = value;
    }
  }

  return result as T;
};
