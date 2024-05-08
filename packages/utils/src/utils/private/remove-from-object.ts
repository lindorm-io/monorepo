import { isArray, isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { _removeFromArray } from "./remove-from-array";

type Predicate = (value: any) => boolean;

export const _removeFromObject = <T extends Dict>(dict: T, predicate: Predicate): T => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(dict)) {
    if (isArray(value)) {
      result[key] = _removeFromArray(value, predicate);
    } else if (isObject(value)) {
      result[key] = _removeFromObject(value, predicate);
    } else if (predicate(value)) {
      continue;
    } else {
      result[key] = value;
    }
  }

  return result as T;
};
