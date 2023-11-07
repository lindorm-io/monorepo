import { AuthorizationSession, BrowserSession, ClientSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import {
  verifyAccessLevel,
  verifyIdentityId,
  verifyMaxAge,
  verifyRequiredFactors,
  verifyRequiredMethods,
  verifyRequiredStrategies,
  verifySessionExpiry,
} from "../../util";

export const verifyLoginPrerequisites = (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
  session?: BrowserSession | ClientSession,
): boolean => {
  const { logger } = ctx;

  if (!session) {
    logger.debug("Login required [no session]");
    return false;
  }

  if (!verifyIdentityId(authorizationSession, session)) {
    logger.debug("Login required [identity id]");
    return false;
  }

  if (!verifyAccessLevel(authorizationSession, session)) {
    logger.debug("Login required [access level]");
    return false;
  }

  if (!verifyRequiredFactors(authorizationSession, session)) {
    logger.debug("Login required [required factors]");
    return false;
  }

  if (!verifyRequiredMethods(authorizationSession, session)) {
    logger.debug("Login required [required methods]");
    return false;
  }

  if (!verifyRequiredStrategies(authorizationSession, session)) {
    logger.debug("Login required [required strategies]");
    return false;
  }

  if (!verifySessionExpiry(session)) {
    logger.debug("Login required [session expiry]");
    return false;
  }

  if (!verifyMaxAge(authorizationSession, session)) {
    logger.debug("Login required [max age]");
    return false;
  }

  return true;
};
