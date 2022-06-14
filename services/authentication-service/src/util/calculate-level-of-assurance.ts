import { AuthenticationMethod } from "../enum";
import { AuthenticationSession } from "../entity";
import { LevelOfAssurance } from "../common";
import { findMethodConfiguration } from "./find-method-configuration";

export const calculateLevelOfAssurance = (
  authenticationSession: AuthenticationSession,
): LevelOfAssurance => {
  let value = 0;
  let maxValue = 0;

  for (const name of authenticationSession.confirmedMethods) {
    const config = findMethodConfiguration(name as AuthenticationMethod);

    value = value + config.value;
    maxValue = config.valueMax > maxValue ? config.valueMax : maxValue;
  }

  return (value > maxValue ? maxValue : value) as LevelOfAssurance;
};
