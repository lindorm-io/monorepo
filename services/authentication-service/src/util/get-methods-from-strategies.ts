import { findStrategyConfig } from "./find-strategy-config";
import { uniq } from "lodash";
import { AuthenticationMethod, AuthenticationStrategy } from "@lindorm-io/common-types";

export const getMethodsFromStrategies = (
  strategies: Array<AuthenticationStrategy>,
): Array<AuthenticationMethod> =>
  uniq(strategies.map((strategy) => findStrategyConfig(strategy).method));
