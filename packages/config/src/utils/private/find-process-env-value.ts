import { ChangeCase, changeCase } from "@lindorm/case";
import { safelyParse } from "@lindorm/utils";
import { ProcessEnv } from "../../types";

export const findProcessEnvValue = (
  processEnv: ProcessEnv,
  key: string,
  parent?: string,
): any => {
  const k = changeCase(key, ChangeCase.Constant);
  const pkey = parent ? changeCase(parent, ChangeCase.Constant) : undefined;

  const search = pkey ? `${pkey}_${k}` : k;
  const value = processEnv[search] ? processEnv[search] : undefined;

  return value ? safelyParse(value) : undefined;
};
