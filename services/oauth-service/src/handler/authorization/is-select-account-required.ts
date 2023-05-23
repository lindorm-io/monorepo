import { OpenIdPromptMode, SessionStatus } from "@lindorm-io/common-types";
import { AuthorizationRequest } from "../../entity";
import { ServerKoaContext } from "../../types";
import { verifyBrowserSessions, verifyPromptMode } from "../../util";

export const isSelectAccountRequired = (
  ctx: ServerKoaContext,
  authorizationRequest: AuthorizationRequest,
): boolean => {
  const { logger } = ctx;

  if (
    [SessionStatus.CONFIRMED, SessionStatus.VERIFIED].includes(authorizationRequest.status.consent)
  ) {
    logger.debug("Select Account not required [session status]");
    return false;
  }

  if (!verifyPromptMode(authorizationRequest, OpenIdPromptMode.SELECT_ACCOUNT)) {
    logger.debug("Select Account required [prompt mode]");
    return true;
  }

  if (!verifyBrowserSessions(authorizationRequest)) {
    logger.debug("Select Account required [browser sessions]");
    return true;
  }

  return false;
};
