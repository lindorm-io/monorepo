import { AuthenticationSession } from "../entity";
import { AuthenticationStrategyConfig } from "../types";

export const getConfigHint = (
  authenticationSession: AuthenticationSession,
  config: AuthenticationStrategyConfig,
): string | null => {
  switch (config.hintType) {
    case "email":
      return authenticationSession.emailHint;

    case "phone":
      return authenticationSession.phoneHint;

    default:
      return null;
  }
};
