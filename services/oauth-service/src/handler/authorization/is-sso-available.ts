import { OpenIdPromptMode } from "@lindorm-io/common-enums";
import { AuthorizationSession, BrowserSession, Client } from "../../entity";
import { ServerKoaContext } from "../../types";
import {
  verifyAccessLevel,
  verifyIdentityId,
  verifyMaxAge,
  verifyPromptMode,
  verifyRequiredFactors,
  verifyRequiredMethods,
  verifyRequiredStrategies,
  verifySessionExpiry,
} from "../../util";

export const isSsoAvailable = (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
  client: Client,
  browserSession?: BrowserSession,
): boolean => {
  const { logger } = ctx;

  if (!browserSession) {
    logger.debug("SSO not available [no browser session]");
    return false;
  }

  if (!browserSession.singleSignOn) {
    logger.debug("SSO not available [browser session sso]");
    return false;
  }

  if (!client.singleSignOn) {
    logger.debug("SSO not available [client sso]");
    return false;
  }

  if (!verifyPromptMode(authorizationSession, OpenIdPromptMode.LOGIN)) {
    logger.debug("SSO not available [prompt mode]");
    return false;
  }

  if (!verifyIdentityId(authorizationSession, browserSession)) {
    logger.debug("SSO not available [identity id]");
    return false;
  }

  if (!verifyAccessLevel(authorizationSession, browserSession)) {
    logger.debug("SSO not available [access level]");
    return false;
  }

  if (!verifyRequiredFactors(authorizationSession, browserSession)) {
    logger.debug("SSO not available [required factors]");
    return false;
  }

  if (!verifyRequiredMethods(authorizationSession, browserSession)) {
    logger.debug("SSO not available [required methods]");
    return false;
  }

  if (!verifyRequiredStrategies(authorizationSession, browserSession)) {
    logger.debug("SSO not available [required strategies]");
    return false;
  }

  if (!verifySessionExpiry(browserSession)) {
    logger.debug("SSO not available [session expiry]");
    return false;
  }

  if (!verifyMaxAge(authorizationSession, browserSession)) {
    logger.debug("SSO not available [max age]");
    return false;
  }

  return true;
};
