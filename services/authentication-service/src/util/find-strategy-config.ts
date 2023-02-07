import { AUTHENTICATION_STRATEGY_CONFIG, AuthenticationStrategyConfig } from "../constant";
import { ServerError } from "@lindorm-io/errors";
import { find } from "lodash";
import { AuthenticationStrategy } from "@lindorm-io/common-types";

export const findStrategyConfig = (
  strategy: AuthenticationStrategy,
): AuthenticationStrategyConfig => {
  const config = find(AUTHENTICATION_STRATEGY_CONFIG, { strategy });

  if (!config) {
    throw new ServerError("Strategy not found");
  }

  return config;
};
