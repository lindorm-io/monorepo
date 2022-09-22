import { AuthenticationSession } from "../entity";
import { findStrategyConfig } from "./find-strategy-config";

export const canGenerateMfaCookie = (authenticationSession: AuthenticationSession): boolean => {
  if (authenticationSession.confirmedStrategies.length < 2) {
    return false;
  }

  for (const strategy of authenticationSession.confirmedStrategies) {
    if (findStrategyConfig(strategy).mfaCookie) {
      return true;
    }
  }

  return false;
};
