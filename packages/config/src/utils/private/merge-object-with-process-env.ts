import { isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { ProcessEnv } from "../../types";
import { mergeValueWithProcessEnv } from "./merge-value-with-process-env";

export const mergeObjectWithProcessEnv = <T extends Dict = Dict>(
  processEnv: ProcessEnv,
  config: T,
  parentKey?: string,
): T => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(config)) {
    const p = parentKey ? `${parentKey}_${key}` : key;

    result[key] = isObject(value)
      ? mergeObjectWithProcessEnv(processEnv, value, p)
      : mergeValueWithProcessEnv(processEnv, value, key, parentKey);
  }

  return result as T;
};
