import { AuthorizationSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { OpenIdPromptMode, SessionStatus } from "@lindorm-io/common-types";

export const isSelectAccountRequired = (authorizationSession: AuthorizationSession): boolean => {
  if (!authorizationSession) {
    throw new ServerError("Session not found", {
      debug: { authorizationSession },
    });
  }

  if (
    authorizationSession.status.selectAccount === SessionStatus.CONFIRMED ||
    authorizationSession.status.selectAccount === SessionStatus.VERIFIED
  ) {
    return false;
  }

  if (authorizationSession.promptModes.includes(OpenIdPromptMode.SELECT_ACCOUNT)) {
    return true;
  }

  return authorizationSession.requestedSelectAccount.browserSessions.length > 1;
};
