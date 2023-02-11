import { Account, AuthenticationSession, StrategySession } from "../../../entity";
import { ServerKoaContext } from "../../../types";
import { configuration } from "../../../server/configuration";
import { LindormTokenTypes } from "@lindorm-io/common-types";
import { ClientError, ServerError } from "@lindorm-io/errors";

interface Options {
  challengeConfirmationToken?: string;
}

export const confirmDeviceChallenge = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
  options: Options,
): Promise<Account> => {
  const {
    jwt,
    logger,
    repository: { accountRepository },
  } = ctx;

  const { challengeConfirmationToken } = options;

  if (!challengeConfirmationToken) {
    throw new ClientError("Invalid input", {
      data: { challengeConfirmationToken },
    });
  }

  logger.debug("Verifying Challenge Confirmation Token");

  if (!authenticationSession.identityId) {
    throw new ServerError("Invalid authenticationSession", {
      debug: { identityId: authenticationSession.identityId },
    });
  }

  if (!strategySession.nonce) {
    throw new ServerError("Invalid strategySession", {
      debug: { nonce: strategySession.nonce },
    });
  }

  const verifiedToken = jwt.verify(challengeConfirmationToken, {
    issuer:
      configuration.services.device_service.issuer || configuration.services.device_service.host,
    nonce: strategySession.nonce,
    scopes: ["authentication"],
    subject: authenticationSession.identityId,
    types: [LindormTokenTypes.CHALLENGE_CONFIRMATION],
  });

  logger.debug("Resolving Account");

  return await accountRepository.find({ id: verifiedToken.subject });
};
