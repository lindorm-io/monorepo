import { AuthorizationSession, BrowserSession, ClientSession } from "../../entity";
import { difference } from "lodash";
import { getAdjustedAccessLevel } from "../get-adjusted-access-level";
import { isBrowserSessionExpired } from "./is-browser-session-expired";
import { isLoginRequiredByMaxAge } from "./is-login-required-by-max-age";

export const isNewLoginRequired = (
  authorizationSession: AuthorizationSession,
  session?: BrowserSession | ClientSession,
): boolean => {
  if (!session) return true;

  if (!session.methods.length || !session.levelOfAssurance) {
    return true;
  }

  if (
    authorizationSession.requestedLogin.identityId &&
    authorizationSession.requestedLogin.identityId !== session.identityId
  ) {
    return true;
  }

  const adjustedLevel = getAdjustedAccessLevel(session);

  if (authorizationSession.requestedLogin.minimumLevel > adjustedLevel) {
    return true;
  }

  if (authorizationSession.requestedLogin.requiredLevel > adjustedLevel) {
    return true;
  }

  if (difference(authorizationSession.requestedLogin.requiredMethods, session.methods).length) {
    return true;
  }

  if (session instanceof BrowserSession && isBrowserSessionExpired(session)) {
    return true;
  }

  return isLoginRequiredByMaxAge(authorizationSession, session);
};
