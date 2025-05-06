import { isObjectLike } from "@lindorm/is";
import { Dict } from "@lindorm/types";

export function sortKeys<T extends Dict = Dict>(arg: T): T {
  const result: Dict = {};

  for (const [key, value] of Object.entries(arg).sort()) {
    if (isObjectLike(value)) {
      result[key] = sortKeys(value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
