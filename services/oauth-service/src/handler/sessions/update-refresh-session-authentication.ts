import { ServerKoaContext } from "../../types";
import { VerifiedAuthenticationConfirmationToken } from "../../common";
import { updateSessionWithAuthToken } from "../../util";

export const updateRefreshSessionAuthentication = async (
  ctx: ServerKoaContext,
  sessionId: string,
  token: VerifiedAuthenticationConfirmationToken,
): Promise<void> => {
  const {
    logger,
    repository: { refreshSessionRepository },
  } = ctx;

  logger.debug("Updating RefreshSession");

  const refreshSession = await refreshSessionRepository.find({ id: sessionId });

  await refreshSessionRepository.update(updateSessionWithAuthToken(refreshSession, token));
};
