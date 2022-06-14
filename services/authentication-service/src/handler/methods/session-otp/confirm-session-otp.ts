import { Account, AuthenticationSession, StrategySession } from "../../../entity";
import { ServerKoaContext } from "../../../types";
import { argon } from "../../../instance";

interface Options {
  otp: string;
}

export const confirmSessionOtp = async (
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

  logger.debug("Resolving Account");

  return await accountRepository.find({ id: authenticationSession.identityId });
};
