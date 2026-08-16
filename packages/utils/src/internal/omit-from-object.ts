import { isArray, isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { omitFromArray } from "./omit-from-array.js";

type Predicate = (value: any) => boolean;

export const omitFromObject = <T extends Dict>(dict: T, predicate: Predicate): T => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(dict)) {
    // Recurse into containers first, THEN test the cleaned result against the
    // predicate — so a container that is empty (or becomes empty after cleaning)
    // is omitted too, not just empty scalars. Whether that happens is the
    // PREDICATE's call: for `omitEmpty` it makes `[]`/`{}` drop, while for
    // `omitUndefined` and `omitEmptyScalars` it is inert because neither
    // predicate is ever true of a container — which is how `omitEmptyScalars`
    // keeps every container without needing a second walker.
    const cleaned = isArray(value)
      ? omitFromArray(value, predicate)
      : isObject(value)
        ? omitFromObject(value, predicate)
        : value;

    if (predicate(cleaned)) continue;

    result[key] = cleaned;
  }

  return result as T;
};
