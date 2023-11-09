import { AuthenticationStrategy } from "@lindorm-io/common-enums";
import { ServerError } from "@lindorm-io/errors";
import { AuthenticationStrategyConfig } from "../../types";
import { STRATEGY_CONFIG_LIST } from "../strategy-config-list";

export const getStrategyConfig = (
  authenticationStrategy: AuthenticationStrategy,
): AuthenticationStrategyConfig => {
  const config = STRATEGY_CONFIG_LIST.find((x) => x.strategy === authenticationStrategy);

  if (!config) {
    throw new ServerError("Strategy config not found");
  }

  return config;
};
