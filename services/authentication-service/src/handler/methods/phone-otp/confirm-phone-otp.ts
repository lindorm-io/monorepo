import { Account, AuthenticationSession, StrategySession } from "../../../entity";
import { ServerKoaContext } from "../../../types";
import { argon } from "../../../instance";
import { authenticateIdentifier } from "../../identity-service";
import { createAccountCallback } from "../../account";

interface Options {
  otp: string;
}

export const confirmPhoneOtp = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
  options: Options,
): Promise<Account> => {
  const {
    logger,
    repository: { accountRepository },
  } = ctx;

  const { otp } = options;

  logger.debug("Verifying OTP");

  await argon.assert(otp, strategySession.otp);

  logger.debug("Verifying Identity");

  const { identityId } = await authenticateIdentifier(ctx, authenticationSession, strategySession);

  logger.debug("Resolving Account");

  return accountRepository.findOrCreate({ id: identityId }, createAccountCallback(ctx));
};
