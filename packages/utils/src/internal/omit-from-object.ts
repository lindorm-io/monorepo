import { isArray, isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { omitFromArray } from "./omit-from-array.js";

type Predicate = (value: any) => boolean;

export const omitFromObject = <T extends Dict>(dict: T, predicate: Predicate): T => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(dict)) {
    if (isArray(value)) {
      result[key] = omitFromArray(value, predicate);
    } else if (isObject(value)) {
      result[key] = omitFromObject(value, predicate);
    } else if (predicate(value)) {
      continue;
    } else {
      result[key] = value;
    }
  }

  return result as T;
};
