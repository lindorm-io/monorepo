import { Account, LoginSession, FlowSession } from "../../../entity";
import { ClientError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../../types";
import { identityAuthenticateIdentifier } from "../../axios";
import { createAccountCallback } from "../../account";

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

  if (otp !== flowSession.otp) {
    throw new ClientError("Invalid OTP");
  }

  logger.debug("Verifying Identity");

  const { identityId } = await identityAuthenticateIdentifier(ctx, loginSession, flowSession);

  logger.debug("Resolving Account");

  return accountRepository.findOrCreate({ id: identityId }, createAccountCallback(ctx));
};
