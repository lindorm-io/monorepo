import { AuthorizationSession, BrowserSession } from "../../entity";
import { PromptMode, SessionStatus } from "../../common";
import { ServerError } from "@lindorm-io/errors";
import { difference, includes } from "lodash";
import { isAuthenticationRequiredByMaxAge } from "./is-authentication-required-by-max-age";

export const isAuthenticationRequired = (
  authorizationSession: AuthorizationSession,
  browserSession: BrowserSession,
): boolean => {
  if (!authorizationSession) {
    throw new ServerError("Internal Server Error", {
      description: "Authorization Session is missing",
    });
  }

  if (!browserSession) {
    throw new ServerError("Internal Server Error", {
      description: "Browser Session is missing",
    });
  }

  if (authorizationSession.authenticationStatus === SessionStatus.CONFIRMED) {
    return false;
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
    authorizationSession.identityId &&
    authorizationSession.identityId !== browserSession.identityId
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

  if (authorizationSession.levelOfAssurance > browserSession.levelOfAssurance) {
    return true;
  }

  if (difference(authorizationSession.authenticationMethods, browserSession.amrValues).length) {
    return true;
  }

  if (includes(authorizationSession.promptModes, PromptMode.LOGIN)) {
    return true;
  }

  if (isAuthenticationRequiredByMaxAge(authorizationSession, browserSession)) {
    return true;
  }

  return false;
};
