import { Account, LoginSession, FlowSession } from "../../../entity";
import { ClientError } from "@lindorm-io/errors";
import { Context } from "../../../types";

interface Options {
  otp: string;
}

export const confirmSessionOtpFlow = async (
  ctx: Context,
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

  logger.debug("Resolving Account");

  return await accountRepository.find({ id: loginSession.identityId });
};
