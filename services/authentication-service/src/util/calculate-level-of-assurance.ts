import { AuthenticationMethod } from "../enum";
import { AuthenticationSession } from "../entity";
import { LevelOfAssurance } from "@lindorm-io/jwt";
import { findMethodConfiguration } from "./find-method-configuration";

interface Result {
  levelOfAssurance: LevelOfAssurance;
  maximumLevelOfAssurance: LevelOfAssurance;
}

export const calculateLevelOfAssurance = (authenticationSession: AuthenticationSession): Result => {
  let value: LevelOfAssurance = 0;
  let maxValue: LevelOfAssurance = 0;

  for (const name of authenticationSession.confirmedMethods) {
    const config = findMethodConfiguration(name as AuthenticationMethod);

    value = (value + config.value) as LevelOfAssurance;
    maxValue = config.valueMax > maxValue ? config.valueMax : maxValue;
  }

  return {
    levelOfAssurance: value > maxValue ? maxValue : value,
    maximumLevelOfAssurance: maxValue,
  };
};
