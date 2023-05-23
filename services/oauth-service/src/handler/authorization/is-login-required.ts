import { OpenIdPromptMode, SessionStatus } from "@lindorm-io/common-types";
import { AuthorizationRequest, BrowserSession, ClientSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { verifyPromptMode } from "../../util";
import { verifyLoginPrerequisites } from "./verify-login-prerequisites";

export const isLoginRequired = (
  ctx: ServerKoaContext,
  authorizationRequest: AuthorizationRequest,
  browserSession?: BrowserSession,
  clientSession?: ClientSession,
): boolean => {
  const { logger } = ctx;

  if (
    [SessionStatus.CONFIRMED, SessionStatus.VERIFIED].includes(authorizationRequest.status.login)
  ) {
    logger.debug("Login not required [session status]");
    return false;
  }

  if (!verifyPromptMode(authorizationRequest, OpenIdPromptMode.LOGIN)) {
    logger.debug("Login required [prompt mode]");
    return true;
  }

  if (!verifyLoginPrerequisites(ctx, authorizationRequest, browserSession)) {
    logger.debug("Login required [browser session]");
    return true;
  }

  if (!verifyLoginPrerequisites(ctx, authorizationRequest, clientSession)) {
    logger.debug("Login required [client session]");
    return true;
  }

  logger.debug("Login not required");
  return false;
};
