import { changeKeys } from "@lindorm/case";
import type { Dict } from "@lindorm/types";
import c from "config";
import type { ProcessEnv } from "../types/index.js";
import { mergeObjectWithProcessEnv } from "./merge-object-with-process-env.js";

export const loadConfig = (processEnv: ProcessEnv): Dict => {
  const config = c.util.toObject();
  const merged = mergeObjectWithProcessEnv(processEnv, config);

  return changeKeys(merged, "camel");
};
