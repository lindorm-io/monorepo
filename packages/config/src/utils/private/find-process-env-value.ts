import { ChangeCase, changeCase } from "@lindorm/case";
import { isString } from "@lindorm/is";
import { ProcessEnv } from "../../types";

const tryParse = (value: string): any => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const findProcessEnvValue = (
  processEnv: ProcessEnv,
  key: string,
  parentKey?: string,
): any => {
  const k: string = changeCase(key, ChangeCase.Constant);
  const p: string | null = parentKey ? changeCase(parentKey, ChangeCase.Constant) : null;

  const search = p ? `${p}_${k}` : k;
  const value = processEnv[search] ? processEnv[search] : null;

  const parsed = value ? tryParse(value) : null;
  const splitArray =
    isString(parsed) && parsed.includes(";") ? parsed.split(";").map(tryParse) : null;

  return splitArray ? splitArray : parsed;
};
