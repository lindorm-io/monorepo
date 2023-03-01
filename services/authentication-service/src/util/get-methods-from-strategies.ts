import { uniq } from "lodash";
import { AuthenticationMethod, AuthenticationStrategy } from "@lindorm-io/common-types";
import { getStrategyConfig } from "../strategies";

export const getMethodsFromStrategies = (
  strategies: Array<AuthenticationStrategy>,
): Array<AuthenticationMethod> =>
  uniq(strategies.map((strategy) => getStrategyConfig(strategy).method));
