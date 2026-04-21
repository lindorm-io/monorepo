import { isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { safelyParse } from "@lindorm/utils";
import type { ProcessEnv } from "../types/index.js";

export const loadNodeConfig = (processEnv: ProcessEnv): Dict => {
  if (!processEnv.NODE_CONFIG) return {};

  if (
    !isString(processEnv.NODE_CONFIG) ||
    !processEnv.NODE_CONFIG.startsWith("{") ||
    !processEnv.NODE_CONFIG.endsWith("}")
  ) {
    throw new Error("Environment variable NODE_CONFIG must be a valid JSON string");
  }

  return safelyParse<Dict>(processEnv.NODE_CONFIG);
};
