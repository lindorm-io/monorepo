import { isArray, isObject } from "@lindorm/is";
import { omitFromObject } from "./omit-from-object.js";

type Predicate = (value: any) => boolean;

export const omitFromArray = <T extends Array<any>>(
  array: T,
  predicate: Predicate,
): T => {
  const result: Array<any> = [];

  for (const value of array) {
    if (isArray(value)) {
      result.push(omitFromArray(value, predicate));
    } else if (isObject(value)) {
      result.push(omitFromObject(value, predicate));
    } else if (predicate(value)) {
      continue;
    } else {
      result.push(value);
    }
  }

  return result as T;
};
