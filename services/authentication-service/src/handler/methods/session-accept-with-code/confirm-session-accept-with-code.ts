import { Account, AuthenticationSession, StrategySession } from "../../../entity";
import { ServerKoaContext } from "../../../types";
import { argon } from "../../../instance";

interface Options {
  code: string;
}

export const confirmSessionAcceptWithCode = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
  options: Options,
): Promise<Account> => {
  const {
    logger,
    repository: { accountRepository },
  } = ctx;

  const { code } = options;

  logger.debug("Verifying Code");

  await argon.assert(code, strategySession.code);

  logger.debug("Resolving Account");

  return await accountRepository.find({ id: authenticationSession.identityId });
};
