import { AuthenticationMethod } from "@lindorm-io/common-enums";
import { uniq } from "lodash";
import { AuthenticationSession } from "../entity";
import { getStrategyConfig } from "../strategies";

export const getMethodsFromStrategies = (
  authenticationSession: AuthenticationSession,
): Array<AuthenticationMethod> =>
  uniq(
    authenticationSession.confirmedStrategies.map((strategy) => getStrategyConfig(strategy).method),
  );
