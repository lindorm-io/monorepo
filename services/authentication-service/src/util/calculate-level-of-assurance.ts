import { LevelOfAssurance } from "@lindorm-io/common-types";
import { AuthenticationSession } from "../entity";
import { getStrategyConfig } from "../strategies";

type Result = {
  level: LevelOfAssurance;
  maximum: LevelOfAssurance;
};

export const calculateLevelOfAssurance = (authenticationSession: AuthenticationSession): Result => {
  let loa: LevelOfAssurance = authenticationSession.confirmedFederationLevel;
  let loaMax: LevelOfAssurance = authenticationSession.confirmedFederationLevel || 0;

  for (const name of authenticationSession.confirmedStrategies) {
    const config = getStrategyConfig(name);

    loa = (loa + config.loa) as LevelOfAssurance;
    loaMax = config.loaMax > loaMax ? config.loaMax : loaMax;
  }

  return {
    level: loa > loaMax ? loaMax : loa,
    maximum: loaMax,
  };
};
