import { Account, LoginSession, FlowSession } from "../../../entity";
import { ServerKoaContext } from "../../../types";
import { argon } from "../../../instance";
import { createAccountCallback } from "../../account";
import { identityAuthenticateIdentifier } from "../../axios";

interface Options {
  otp: string;
}

export const confirmPhoneOtpFlow = async (
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

  logger.debug("Verifying Identity");

  const { identityId } = await identityAuthenticateIdentifier(ctx, loginSession, flowSession);

  logger.debug("Resolving Account");

  return accountRepository.findOrCreate({ id: identityId }, createAccountCallback(ctx));
};
