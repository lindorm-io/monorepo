import { AccessSession, AuthorizationSession, BrowserSession, RefreshSession } from "../../entity";
import { OauthPromptModes, SessionStatuses } from "@lindorm-io/common-types";
import { ServerError } from "@lindorm-io/errors";
import { isNewLoginRequired } from "./is-new-login-required";

export const isLoginRequired = (
  authorizationSession: AuthorizationSession,
  browserSession?: BrowserSession,
  accessSession?: AccessSession,
  refreshSession?: RefreshSession,
): boolean => {
  if (!authorizationSession) {
    throw new ServerError("Session not found", {
      debug: { authorizationSession },
    });
  }

  if (
    authorizationSession.status.login === SessionStatuses.CONFIRMED ||
    authorizationSession.status.login === SessionStatuses.VERIFIED
  ) {
    return false;
  }

  if (authorizationSession.promptModes.includes(OauthPromptModes.LOGIN)) {
    return true;
  }

  const accessRequired = isNewLoginRequired(authorizationSession, accessSession);
  const browserRequired = isNewLoginRequired(authorizationSession, browserSession);
  const refreshRequired = isNewLoginRequired(authorizationSession, refreshSession);

  if (
    !!browserSession &&
    !browserRequired &&
    !browserSession?.sso &&
    accessRequired &&
    refreshRequired
  ) {
    return true;
  }

  return [accessRequired, browserRequired, refreshRequired].every((x) => x);
};
