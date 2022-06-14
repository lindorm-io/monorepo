import { Account, AuthenticationSession, StrategySession } from "../../../entity";
import { ServerKoaContext } from "../../../types";
import { argon } from "../../../instance";
import { authenticateIdentifier } from "../../identity-service";
import { createAccountCallback } from "../../account";

interface Options {
  code: string;
}

export const confirmEmailLink = async (
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

  logger.debug("Verifying Identity");

  const { identityId } = await authenticateIdentifier(ctx, authenticationSession, strategySession);

  logger.debug("Resolving Account");

  return accountRepository.findOrCreate({ id: identityId }, createAccountCallback(ctx));
};
