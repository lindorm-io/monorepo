import { isObject, isUndefined } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { ProcessEnv } from "../../types";
import { findProcessEnvValue } from "./find-process-env-value";

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
