import { changeKeys } from "@lindorm/case";
import { Dict } from "@lindorm/types";
import c from "config";
import { ProcessEnv } from "../../types";
import { mergeObjectWithProcessEnv } from "./merge-object-with-process-env";

export const loadConfig = (processEnv: ProcessEnv): Dict => {
  const config = c.util.toObject();
  const merged = mergeObjectWithProcessEnv(processEnv, config);

  return changeKeys(merged, "camel");
};
