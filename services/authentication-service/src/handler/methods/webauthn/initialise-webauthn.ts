import { AuthenticationSession, StrategySession } from "../../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../../types";

export const initialiseWebauthn = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
): Promise<void> => {
  console.log(authenticationSession, strategySession);

  throw new ServerError("Flow not implemented");
};
