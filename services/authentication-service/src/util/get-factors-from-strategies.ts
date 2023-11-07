import { AuthenticationFactor } from "@lindorm-io/common-types";
import { uniq } from "lodash";
import { AuthenticationSession } from "../entity";
import { getStrategyConfig } from "../strategies";

export const getFactorsFromStrategies = (
  authenticationSession: AuthenticationSession,
): Array<AuthenticationFactor> =>
  uniq(
    authenticationSession.confirmedStrategies.map((strategy) => getStrategyConfig(strategy).factor),
  );
