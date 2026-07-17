import { isArray, isObject } from "@lindorm/is";
import { omitFromObject } from "./omit-from-object.js";

type Predicate = (value: any) => boolean;

export const omitFromArray = <T extends Array<any>>(
  array: T,
  predicate: Predicate,
): T => {
  const result: Array<any> = [];

  for (const value of array) {
    // Recurse into containers first, THEN test the cleaned result — so an empty
    // (or emptied) array/object element is dropped, matching the scalar rule.
    const cleaned = isArray(value)
      ? omitFromArray(value, predicate)
      : isObject(value)
        ? omitFromObject(value, predicate)
        : value;

    if (predicate(cleaned)) continue;

    result.push(cleaned);
  }

  return result as T;
};
