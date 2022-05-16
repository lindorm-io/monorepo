import { Account, LoginSession, FlowSession } from "../../../entity";
import { ServerKoaContext } from "../../../types";
import { TokenType } from "../../../enum";
import { configuration } from "../../../server/configuration";

interface Options {
  challengeConfirmationToken: string;
}

export const confirmRdcQrCodeFlow = async (
  ctx: ServerKoaContext,
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

  const { subject } = jwt.verify(challengeConfirmationToken, {
    issuer:
      configuration.services.device_service.issuer || configuration.services.device_service.host,
    nonce: flowSession.nonce,
    scopes: ["authentication"],
    types: [TokenType.CHALLENGE_CONFIRMATION_TOKEN],
  });

  logger.debug("Resolving Account");

  return await accountRepository.find({ id: subject });
};
