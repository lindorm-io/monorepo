import { OpenIdPromptMode, SessionStatus } from "@lindorm-io/common-types";
import { AuthorizationRequest, BrowserSession, ClientSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { verifyPromptMode, verifyRequiredAudiences, verifyRequiredScopes } from "../../util";

export const isConsentRequired = (
  ctx: ServerKoaContext,
  authorizationRequest: AuthorizationRequest,
  browserSession?: BrowserSession,
  clientSession?: ClientSession,
): boolean => {
  const { logger } = ctx;

  if (
    [SessionStatus.CONFIRMED, SessionStatus.VERIFIED].includes(authorizationRequest.status.consent)
  ) {
    logger.debug("Consent not required [session status]");
    return false;
  }

  if (!verifyPromptMode(authorizationRequest, OpenIdPromptMode.CONSENT)) {
    logger.debug("Consent required [prompt mode]");
    return true;
  }

  if (!browserSession) {
    logger.debug("Consent required [no browser session]");
    return true;
  }

  if (!clientSession) {
    logger.debug("Consent required [no client session]");
    return true;
  }

  if (!verifyRequiredAudiences(authorizationRequest, clientSession)) {
    logger.debug("Consent required [audiences]");
    return true;
  }

  if (!verifyRequiredScopes(authorizationRequest, clientSession)) {
    logger.debug("Consent required [scopes]");
    return true;
  }

  logger.debug("Consent not required");
  return false;
};
