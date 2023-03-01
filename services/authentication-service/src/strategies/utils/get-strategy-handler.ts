import { AuthenticationStrategy } from "@lindorm-io/common-types";
import { ENABLED_STRATEGIES } from "../enabled-strategies";
import { ServerError } from "@lindorm-io/errors";
import { StrategyHandler } from "../../types";

export const getStrategyHandler = (
  authenticationStrategy: AuthenticationStrategy,
): StrategyHandler => {
  const strategy = ENABLED_STRATEGIES.find(
    (handler) => handler.config.strategy === authenticationStrategy,
  );

  if (!strategy) {
    throw new ServerError("Strategy not found");
  }

  return strategy;
};
