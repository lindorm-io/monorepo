import { AuthenticationSession } from "../entity";
import { getStrategyConfig } from "../strategies";

export const canGenerateMfaCookie = (authenticationSession: AuthenticationSession): boolean => {
  if (authenticationSession.confirmedStrategies.length < 2) {
    return false;
  }

  for (const strategy of authenticationSession.confirmedStrategies) {
    if (getStrategyConfig(strategy).mfaCookie) {
      return true;
    }
  }

  return false;
};
