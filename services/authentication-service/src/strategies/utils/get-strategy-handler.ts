import { AuthenticationStrategy } from "@lindorm-io/common-enums";
import { ServerError } from "@lindorm-io/errors";
import { StrategyHandler } from "../../types";
import { ENABLED_STRATEGIES } from "../enabled-strategies";

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
