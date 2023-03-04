import { AuthorizationSession, BrowserSession, ClientSession } from "../../entity";
import { OpenIdPromptMode, SessionStatus } from "@lindorm-io/common-types";
import { ServerError } from "@lindorm-io/errors";
import { isNewLoginRequired } from "./is-new-login-required";

export const isLoginRequired = (
  authorizationSession: AuthorizationSession,
  browserSession?: BrowserSession,
  clientSession?: ClientSession,
): boolean => {
  if (!authorizationSession) {
    throw new ServerError("Session not found", {
      debug: { authorizationSession },
    });
  }

  if (
    authorizationSession.status.login === SessionStatus.CONFIRMED ||
    authorizationSession.status.login === SessionStatus.VERIFIED
  ) {
    return false;
  }

  if (authorizationSession.promptModes.includes(OpenIdPromptMode.LOGIN)) {
    return true;
  }

  const browserRequired = isNewLoginRequired(authorizationSession, browserSession);
  const clientRequired = isNewLoginRequired(authorizationSession, clientSession);

  if (!!browserSession && !browserRequired && !browserSession?.sso && clientRequired) {
    return true;
  }

  return [browserRequired, clientRequired].every((x) => x);
};
