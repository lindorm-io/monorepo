import { Account, StrategySession } from "../../../entity";
import { ServerKoaContext } from "../../../types";
import { TokenType } from "../../../common";
import { configuration } from "../../../server/configuration";

interface Options {
  challengeConfirmationToken: string;
}

export const confirmRdcQrCode = async (
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
    issuer:
      configuration.services.device_service.issuer || configuration.services.device_service.host,
    nonce: strategySession.nonce,
    scopes: ["authentication"],
    types: [TokenType.CHALLENGE_CONFIRMATION],
  });

  logger.debug("Resolving Account");

  return await accountRepository.find({ id: subject });
};
