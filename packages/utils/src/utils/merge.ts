import { isArray, isObject, isUndefined } from "@lindorm/is";
import { Dict } from "@lindorm/types";

export const merge = <T extends Dict>(origin: Dict, ...records: Array<Dict>): T => {
  const result: Dict = { ...origin };

  for (const record of records) {
    if (!record) continue;

    for (const [key, value] of Object.entries(record)) {
      if (isUndefined(value)) continue;

      if (isArray(value)) {
        if (isUndefined(result[key])) {
          result[key] = [...value];
        } else if (isArray(result[key])) {
          result[key] = [...result[key], ...value];
        } else {
          throw new TypeError(`Cannot merge array into non-array value at key "${key}"`);
        }
      } else if (isObject(value)) {
        if (isUndefined(result[key])) {
          result[key] = { ...value };
        } else if (isObject(result[key])) {
          result[key] = merge(result[key], value);
        } else {
          throw new TypeError(
            `Cannot merge object into non-object value at key "${key}"`,
          );
        }
      } else {
        result[key] = value;
      }
    }
  }

  return result as T;
};
