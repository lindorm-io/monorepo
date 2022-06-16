import { ServerKoaContext } from "../../types";
import { VerifiedAuthenticationConfirmationToken } from "../../common";
import { updateSessionWithAuthToken } from "../../util";

export const updateBrowserSessionAuthentication = async (
  ctx: ServerKoaContext,
  sessionId: string,
  token: VerifiedAuthenticationConfirmationToken,
): Promise<void> => {
  const {
    logger,
    repository: { browserSessionRepository },
  } = ctx;

  logger.debug("Updating BrowserSession");

  const browserSession = await browserSessionRepository.find({ id: sessionId });

  await browserSessionRepository.update(updateSessionWithAuthToken(browserSession, token));
};
