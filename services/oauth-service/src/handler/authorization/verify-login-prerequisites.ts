import { AuthorizationRequest, BrowserSession, ClientSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import {
  verifyAccessLevel,
  verifyIdentityId,
  verifyMaxAge,
  verifyRequiredMethods,
  verifySessionExpiry,
} from "../../util";

export const verifyLoginPrerequisites = (
  ctx: ServerKoaContext,
  authorizationRequest: AuthorizationRequest,
  session?: BrowserSession | ClientSession,
): boolean => {
  const { logger } = ctx;

  if (!session) {
    logger.debug("Login required [no session]");
    return false;
  }

  if (!verifyIdentityId(authorizationRequest, session)) {
    logger.debug("Login required [identity id]");
    return false;
  }

  if (!verifyAccessLevel(authorizationRequest, session)) {
    logger.debug("Login required [access level]");
    return false;
  }

  if (!verifyRequiredMethods(authorizationRequest, session)) {
    logger.debug("Login required [required methods]");
    return false;
  }

  if (!verifySessionExpiry(session)) {
    logger.debug("Login required [session expiry]");
    return false;
  }

  if (!verifyMaxAge(authorizationRequest, session)) {
    logger.debug("Login required [max age]");
    return false;
  }

  return true;
};
