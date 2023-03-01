import { AuthenticationSession } from "../entity";
import { AuthenticationStrategy } from "@lindorm-io/common-types";
import { AuthenticationStrategyConfig } from "../types";
import { STRATEGY_CONFIG_LIST } from "../strategies";
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
    authenticationSession.confirmedStrategies.length >= config.methodsMin &&
    authenticationSession.confirmedStrategies.length <= config.methodsMax;

export const getAvailableStrategies = (
  authenticationSession: AuthenticationSession,
): Array<AuthenticationStrategy> =>
  STRATEGY_CONFIG_LIST.filter(hasUnusedMethod(authenticationSession))
    .filter(hasUnusedStrategy(authenticationSession))
    .filter(hasAllowedAmrValues(authenticationSession))
    .map((item) => item.strategy);
