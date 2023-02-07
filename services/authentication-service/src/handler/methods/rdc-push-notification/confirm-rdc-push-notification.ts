import { Account, StrategySession } from "../../../entity";
import { ServerKoaContext } from "../../../types";
import { configuration } from "../../../server/configuration";
import { LindormTokenTypes } from "@lindorm-io/common-types";

interface Options {
  challengeConfirmationToken: string;
}

export const confirmRdcPushNotification = async (
  ctx: ServerKoaContext,
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

  const { subject } = jwt.verify(challengeConfirmationToken, {
    audiences: [configuration.oauth.client_id],
    issuer: configuration.services.device_service.issuer,
    nonce: strategySession.nonce,
    scopes: ["authentication"],
    types: [LindormTokenTypes.CHALLENGE_CONFIRMATION],
  });

  logger.debug("Resolving Account");

  return await accountRepository.find({ id: subject });
};
