import { Dict } from "@lindorm/types";
import fastSafeStringify from "fast-safe-stringify";
import { inspect } from "util";

export const inspectDictionary = (
  dict: Dict,
  colors: boolean = true,
  depth = Infinity,
): string => {
  try {
    return inspect(dict, {
      colors,
      depth,
      compact: 5,
      breakLength: process.stdout.columns ? process.stdout.columns - 10 : 140,
      sorted: true,
    });
  } catch {
    return fastSafeStringify(dict);
  }
};
