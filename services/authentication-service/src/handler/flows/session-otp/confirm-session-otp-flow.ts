import { Account, LoginSession, FlowSession } from "../../../entity";
import { ServerKoaContext } from "../../../types";
import { argon } from "../../../instance";

interface Options {
  otp: string;
}

export const confirmSessionOtpFlow = async (
  ctx: ServerKoaContext,
  loginSession: LoginSession,
  flowSession: FlowSession,
  options: Options,
): Promise<Account> => {
  const {
    logger,
    repository: { accountRepository },
  } = ctx;

  const { otp } = options;

  logger.info("Confirming Flow", {
    loginSessionId: loginSession.id,
    flowSessionId: flowSession.id,
    type: flowSession.type,
  });

  logger.debug("Verifying OTP");

  await argon.assert(otp, flowSession.otp);

  logger.debug("Resolving Account");

  return await accountRepository.find({ id: loginSession.identityId });
};
