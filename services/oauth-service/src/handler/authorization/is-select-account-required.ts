import { OpenIdPromptMode, SessionStatus } from "@lindorm-io/common-enums";
import { AuthorizationSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { verifyBrowserSessions, verifyPromptMode } from "../../util";

export const isSelectAccountRequired = (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
): boolean => {
  const { logger } = ctx;

  if (
    [SessionStatus.CONFIRMED, SessionStatus.VERIFIED].includes(authorizationSession.status.consent)
  ) {
    logger.debug("Select Account not required [session status]");
    return false;
  }

  if (!verifyPromptMode(authorizationSession, OpenIdPromptMode.SELECT_ACCOUNT)) {
    logger.debug("Select Account required [prompt mode]");
    return true;
  }

  if (!verifyBrowserSessions(authorizationSession)) {
    logger.debug("Select Account required [browser sessions]");
    return true;
  }

  return false;
};
