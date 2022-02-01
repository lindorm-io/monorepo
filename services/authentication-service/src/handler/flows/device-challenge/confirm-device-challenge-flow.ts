import { Account, LoginSession, FlowSession } from "../../../entity";
import { Context } from "../../../types";
import { TokenType } from "../../../enum";
import { configuration } from "../../../configuration";

interface Options {
  challengeConfirmationToken: string;
}

export const confirmDeviceChallengeFlow = async (
  ctx: Context,
  loginSession: LoginSession,
  flowSession: FlowSession,
  options: Options,
): Promise<Account> => {
  const {
    jwt,
    logger,
    repository: { accountRepository },
  } = ctx;

  const { challengeConfirmationToken } = options;

  logger.info("Confirming Flow", {
    loginSessionId: loginSession.id,
    flowSessionId: flowSession.id,
    type: flowSession.type,
  });

  logger.debug("Verifying Challenge Confirmation Token");

  jwt.verify(challengeConfirmationToken, {
    issuer: configuration.services.device_service,
    nonce: flowSession.nonce,
    scopes: ["authentication"],
    subject: loginSession.identityId,
    types: [TokenType.CHALLENGE_CONFIRMATION_TOKEN],
  });

  logger.debug("Resolving Account");

  return await accountRepository.find({ id: loginSession.identityId });
};
