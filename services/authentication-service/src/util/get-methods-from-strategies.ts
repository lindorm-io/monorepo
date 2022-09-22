import { AuthenticationMethod } from "../common";
import { AuthenticationStrategy } from "../enum";
import { findStrategyConfig } from "./find-strategy-config";
import { uniq } from "lodash";

export const getMethodsFromStrategies = (
  strategies: Array<AuthenticationStrategy>,
): Array<AuthenticationMethod> =>
  uniq(strategies.map((strategy) => findStrategyConfig(strategy).method));
