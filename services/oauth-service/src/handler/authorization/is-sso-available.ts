import { OpenIdPromptMode } from "@lindorm-io/common-types";
import { AuthorizationRequest, BrowserSession, Client } from "../../entity";
import { ServerKoaContext } from "../../types";
import {
  verifyAccessLevel,
  verifyIdentityId,
  verifyMaxAge,
  verifyPromptMode,
  verifyRequiredMethods,
  verifySessionExpiry,
} from "../../util";

export const isSsoAvailable = (
  ctx: ServerKoaContext,
  authorizationRequest: AuthorizationRequest,
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

  if (!verifyPromptMode(authorizationRequest, OpenIdPromptMode.LOGIN)) {
    logger.debug("SSO not available [prompt mode]");
    return false;
  }

  if (!verifyIdentityId(authorizationRequest, browserSession)) {
    logger.debug("SSO not available [identity id]");
    return false;
  }

  if (!verifyAccessLevel(authorizationRequest, browserSession)) {
    logger.debug("SSO not available [access level]");
    return false;
  }

  if (!verifyRequiredMethods(authorizationRequest, browserSession)) {
    logger.debug("SSO not available [required methods]");
    return false;
  }

  if (!verifySessionExpiry(browserSession)) {
    logger.debug("SSO not available [session expiry]");
    return false;
  }

  if (!verifyMaxAge(authorizationRequest, browserSession)) {
    logger.debug("SSO not available [max age]");
    return false;
  }

  return true;
};
