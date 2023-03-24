import { uniq } from "lodash";
import { AuthenticationMethod } from "@lindorm-io/common-types";
import { getStrategyConfig } from "../strategies";
import { AuthenticationSession } from "../entity";

export const getMethodsFromStrategies = (
  authenticationSession: AuthenticationSession,
): Array<AuthenticationMethod> =>
  uniq(
    authenticationSession.confirmedStrategies.map((strategy) => getStrategyConfig(strategy).method),
  );
