import { AuthenticationSession } from "../entity";
import { LevelOfAssurance } from "@lindorm-io/common-types";
import { findStrategyConfig } from "./find-strategy-config";

type Result = {
  level: LevelOfAssurance;
  maximum: LevelOfAssurance;
};

export const calculateLevelOfAssurance = (authenticationSession: AuthenticationSession): Result => {
  let value: LevelOfAssurance = authenticationSession.confirmedOidcLevel;
  let maxValue: LevelOfAssurance = authenticationSession.confirmedOidcLevel || 0;

  for (const name of authenticationSession.confirmedStrategies) {
    const config = findStrategyConfig(name);

    value = (value + config.value) as LevelOfAssurance;
    maxValue = config.valueMax > maxValue ? config.valueMax : maxValue;
  }

  return {
    level: value > maxValue ? maxValue : value,
    maximum: maxValue,
  };
};
