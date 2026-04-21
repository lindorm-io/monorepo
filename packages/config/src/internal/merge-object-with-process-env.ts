import { isObject, isUndefined } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { ProcessEnv } from "../types/index.js";
import { findProcessEnvValue } from "./find-process-env-value.js";

export const mergeObjectWithProcessEnv = (
  processEnv: ProcessEnv,
  config: Dict,
  parent?: string,
): Dict => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(config)) {
    const env = findProcessEnvValue(processEnv, key, parent);

    if (!isUndefined(env)) {
      result[key] = env;
      continue;
    }

    if (isObject(value)) {
      const pkey = parent ? `${parent}_${key}` : key;
      result[key] = mergeObjectWithProcessEnv(processEnv, value, pkey);
      continue;
    }

    result[key] = value;
  }

  return result;
};
