import { Account, AuthenticationSession, StrategySession } from "../../../entity";
import { ServerKoaContext } from "../../../types";
import { configuration } from "../../../server/configuration";
import { LindormTokenTypes } from "@lindorm-io/common-types";

interface Options {
  challengeConfirmationToken: string;
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

  logger.debug("Verifying Challenge Confirmation Token");

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
