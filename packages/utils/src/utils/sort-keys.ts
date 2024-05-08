import { Dict } from "@lindorm/types";

export function sortKeys<T extends Dict = Dict>(arg: T): T {
  const result: Dict = {};

  for (const key of Object.keys(arg as Dict).sort()) {
    result[key] = (arg as Dict)[key];
  }

  return result as T;
}
