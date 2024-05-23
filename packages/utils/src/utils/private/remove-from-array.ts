import { isArray, isObject } from "@lindorm/is";
import { removeFromObject } from "./remove-from-object";

type Predicate = (value: any) => boolean;

export const removeFromArray = <T extends Array<any>>(
  array: T,
  predicate: Predicate,
): T => {
  const result: Array<any> = [];

  for (const value of array) {
    if (isArray(value)) {
      result.push(removeFromArray(value, predicate));
    } else if (isObject(value)) {
      result.push(removeFromObject(value, predicate));
    } else if (predicate(value)) {
      continue;
    } else {
      result.push(value);
    }
  }

  return result as T;
};
