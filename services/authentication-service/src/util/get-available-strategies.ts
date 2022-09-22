import { AUTHENTICATION_STRATEGY_CONFIG, AuthenticationStrategyConfig } from "../constant";
import { AuthenticationSession } from "../entity";
import { AuthenticationStrategy } from "../enum";
import { getMethodsFromStrategies } from "./get-methods-from-strategies";

const hasUnusedMethod =
  (authenticationSession: AuthenticationSession) =>
  (config: AuthenticationStrategyConfig): boolean =>
    !getMethodsFromStrategies(authenticationSession.confirmedStrategies).includes(config.method);

const hasUnusedStrategy =
  (authenticationSession: AuthenticationSession) =>
  (config: AuthenticationStrategyConfig): boolean =>
    !authenticationSession.confirmedStrategies.includes(config.strategy);

const hasAllowedAmrValues =
  (authenticationSession: AuthenticationSession) =>
  (config: AuthenticationStrategyConfig): boolean =>
    authenticationSession.confirmedStrategies.length >= config.amrValuesMin &&
    authenticationSession.confirmedStrategies.length <= config.amrValuesMax;

export const getAvailableStrategies = (
  authenticationSession: AuthenticationSession,
): Array<AuthenticationStrategy> =>
  AUTHENTICATION_STRATEGY_CONFIG.filter(hasUnusedMethod(authenticationSession))
    .filter(hasUnusedStrategy(authenticationSession))
    .filter(hasAllowedAmrValues(authenticationSession))
    .map((item) => item.strategy);
