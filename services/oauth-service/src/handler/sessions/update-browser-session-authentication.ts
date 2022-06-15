import { LevelOfAssurance, VerifiedAuthenticationConfirmationToken } from "../../common";
import { ServerKoaContext } from "../../types";
import { flatten, uniq } from "lodash";
import { fromUnixTime } from "date-fns";

export const updateBrowserSessionAuthentication = async (
  ctx: ServerKoaContext,
  sessionId: string,
  token: VerifiedAuthenticationConfirmationToken,
): Promise<void> => {
  const {
    logger,
    repository: { browserSessionRepository },
  } = ctx;

  const { authContextClass, authMethodsReference, authTime, levelOfAssurance } = token;

  logger.debug("Updating BrowserSession");

  const browserSession = await browserSessionRepository.find({ id: sessionId });

  browserSession.acrValues = authContextClass;
  browserSession.amrValues = uniq(flatten([browserSession.amrValues, authMethodsReference]));
  browserSession.latestAuthentication = fromUnixTime(authTime);
  browserSession.levelOfAssurance = levelOfAssurance as LevelOfAssurance;

  await browserSessionRepository.update(browserSession);
};
