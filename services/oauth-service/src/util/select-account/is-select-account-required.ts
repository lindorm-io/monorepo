import { OauthPromptModes, SessionStatuses } from "@lindorm-io/common-types";
import { AuthorizationSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";

export const isSelectAccountRequired = (authorizationSession: AuthorizationSession): boolean => {
  if (!authorizationSession) {
    throw new ServerError("Session not found", {
      debug: { authorizationSession },
    });
  }

  if (
    authorizationSession.status.selectAccount === SessionStatuses.CONFIRMED ||
    authorizationSession.status.selectAccount === SessionStatuses.VERIFIED
  ) {
    return false;
  }

  if (authorizationSession.promptModes.includes(OauthPromptModes.SELECT_ACCOUNT)) {
    return true;
  }

  return authorizationSession.requestedSelectAccount.browserSessions.length > 1;
};
