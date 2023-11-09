import { OpenIdPromptMode, SessionStatus } from "@lindorm-io/common-enums";
import { AuthorizationSession, BrowserSession, ClientSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { verifyPromptMode } from "../../util";
import { verifyLoginPrerequisites } from "./verify-login-prerequisites";

export const isLoginRequired = (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
  browserSession?: BrowserSession,
  clientSession?: ClientSession,
): boolean => {
  const { logger } = ctx;

  if (
    [SessionStatus.CONFIRMED, SessionStatus.VERIFIED].includes(authorizationSession.status.login)
  ) {
    logger.debug("Login not required [session status]");
    return false;
  }

  if (!verifyPromptMode(authorizationSession, OpenIdPromptMode.LOGIN)) {
    logger.debug("Login required [prompt mode]");
    return true;
  }

  if (!verifyLoginPrerequisites(ctx, authorizationSession, browserSession)) {
    logger.debug("Login required [browser session]");
    return true;
  }

  if (!verifyLoginPrerequisites(ctx, authorizationSession, clientSession)) {
    logger.debug("Login required [client session]");
    return true;
  }

  logger.debug("Login not required");
  return false;
};
