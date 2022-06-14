import { Account, AuthenticationSession, StrategySession } from "../../../entity";
import { ServerKoaContext } from "../../../types";
import { ServerError } from "@lindorm-io/errors";

interface Options {
  data: any;
}

export const confirmBankIdSe = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
  options: Options,
): Promise<Account> => {
  console.log(options);

  throw new ServerError("Flow not implemented");
};
