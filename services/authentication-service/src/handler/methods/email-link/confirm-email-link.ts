import { Account, AuthenticationSession, StrategySession } from "../../../entity";
import { ServerKoaContext } from "../../../types";
import { argon } from "../../../instance";
import { authenticateIdentifier } from "../../identity-service";
import { createAccountCallback } from "../../account";
import { ClientError, ServerError } from "@lindorm-io/errors";

interface Options {
  code?: string;
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

  if (!code) {
    throw new ClientError("Invalid input", {
      data: { code },
    });
  }

  logger.debug("Verifying Code");

  if (!strategySession.code) {
    throw new ServerError("Invalid strategySession", {
      debug: { code: strategySession.code },
    });
  }

  await argon.assert(code, strategySession.code);

  logger.debug("Verifying Identity");

  const { identityId } = await authenticateIdentifier(ctx, authenticationSession, strategySession);

  logger.debug("Resolving Account");

  return accountRepository.findOrCreate({ id: identityId }, createAccountCallback(ctx));
};
