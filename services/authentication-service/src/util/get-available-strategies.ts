import { AuthenticationSession } from "../entity";
import { AuthenticationStrategy } from "@lindorm-io/common-types";
import { AuthenticationStrategyConfig } from "../types";
import { STRATEGY_CONFIG_LIST } from "../strategies";
import { getMethodsFromStrategies } from "./get-methods-from-strategies";

const hasUnusedMethod =
  (authenticationSession: AuthenticationSession) =>
  (config: AuthenticationStrategyConfig): boolean =>
    !getMethodsFromStrategies(authenticationSession).includes(config.method);

const isPrimaryOrSecondary =
  (authenticationSession: AuthenticationSession) =>
  (config: AuthenticationStrategyConfig): boolean =>
    (authenticationSession.confirmedStrategies.length === 0 && config.primary) ||
    (authenticationSession.confirmedStrategies.length >= 1 && config.secondary);

export const getAvailableStrategies = (
  authenticationSession: AuthenticationSession,
): Array<AuthenticationStrategy> =>
  STRATEGY_CONFIG_LIST.filter(hasUnusedMethod(authenticationSession))
    .filter(isPrimaryOrSecondary(authenticationSession))
    .map((item) => item.strategy);
