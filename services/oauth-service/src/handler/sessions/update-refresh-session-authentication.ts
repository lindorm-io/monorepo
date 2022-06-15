import { LevelOfAssurance, VerifiedAuthenticationConfirmationToken } from "../../common";
import { ServerKoaContext } from "../../types";
import { flatten, uniq } from "lodash";
import { fromUnixTime } from "date-fns";

export const updateRefreshSessionAuthentication = async (
  ctx: ServerKoaContext,
  sessionId: string,
  token: VerifiedAuthenticationConfirmationToken,
): Promise<void> => {
  const {
    logger,
    repository: { refreshSessionRepository },
  } = ctx;

  const { authContextClass, authMethodsReference, authTime, levelOfAssurance } = token;

  logger.debug("Updating RefreshSession");

  const refreshSession = await refreshSessionRepository.find({ id: sessionId });

  refreshSession.acrValues = authContextClass;
  refreshSession.amrValues = uniq(flatten([refreshSession.amrValues, authMethodsReference]));
  refreshSession.latestAuthentication = fromUnixTime(authTime);
  refreshSession.levelOfAssurance = levelOfAssurance as LevelOfAssurance;

  await refreshSessionRepository.update(refreshSession);
};
