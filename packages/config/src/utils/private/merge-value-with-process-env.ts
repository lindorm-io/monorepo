import { ProcessEnv } from "../../types";
import { findProcessEnvValue } from "./find-process-env-value";

export const mergeValueWithProcessEnv = (
  processEnv: ProcessEnv,
  value: string,
  key: string,
  parentKey?: string,
): string => {
  const envValue = findProcessEnvValue(processEnv, key, parentKey);

  return envValue ? envValue : value;
};
