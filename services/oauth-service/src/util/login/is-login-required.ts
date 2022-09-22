import { AuthorizationSession, BrowserSession } from "../../entity";
import { PromptMode, SessionStatus } from "../../common";
import { ServerError } from "@lindorm-io/errors";
import { difference } from "lodash";
import { getAdjustedAccessLevel } from "../get-adjusted-access-level";
import { isLoginRequiredByMaxAge } from "./is-login-required-by-max-age";

export const isLoginRequired = (
  authorizationSession: AuthorizationSession,
  browserSession: BrowserSession,
): boolean => {
  if (!authorizationSession) {
    throw new ServerError("Internal Server Error", {
      description: "Authorization Session is missing",
    });
  }

  if (authorizationSession.status.login === SessionStatus.CONFIRMED) {
    return false;
  }

  if (!browserSession) {
    return true;
  }

  if (
    !browserSession.identityId ||
    !browserSession.levelOfAssurance ||
    !browserSession.acrValues.length ||
    !browserSession.amrValues.length
  ) {
    return true;
  }

  if (
    authorizationSession.requestedLogin.identityId &&
    authorizationSession.requestedLogin.identityId !== browserSession.identityId
  ) {
    return true;
  }

  if (
    authorizationSession.country &&
    browserSession.country &&
    authorizationSession.country !== browserSession.country
  ) {
    return true;
  }

  if (
    authorizationSession.requestedLogin.levelOfAssurance > getAdjustedAccessLevel(browserSession)
  ) {
    return true;
  }

  if (
    difference(authorizationSession.requestedLogin.authenticationMethods, browserSession.amrValues)
      .length
  ) {
    return true;
  }

  if (authorizationSession.promptModes.includes(PromptMode.LOGIN)) {
    return true;
  }

  if (isLoginRequiredByMaxAge(authorizationSession, browserSession)) {
    return true;
  }

  return false;
};
