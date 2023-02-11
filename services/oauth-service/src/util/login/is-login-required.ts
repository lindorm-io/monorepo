import { AuthorizationSession, BrowserSession } from "../../entity";
import { OauthPromptModes } from "@lindorm-io/common-types";
import { ServerError } from "@lindorm-io/errors";
import { difference } from "lodash";
import { getAdjustedAccessLevel } from "../get-adjusted-access-level";
import { isLoginRequiredByMaxAge } from "./is-login-required-by-max-age";

export const isLoginRequired = (
  authorizationSession: AuthorizationSession,
  browserSession?: BrowserSession,
): boolean => {
  if (!authorizationSession) {
    throw new ServerError("Internal Server Error", {
      description: "Authorization Session is missing",
    });
  }

  if (["confirmed", "verified"].includes(authorizationSession.status.login)) {
    return false;
  }

  if (!browserSession) {
    return true;
  }

  if (
    !browserSession.acrValues.length ||
    !browserSession.amrValues.length ||
    !browserSession.levelOfAssurance
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

  const adjustedLevel = getAdjustedAccessLevel(browserSession);

  if (authorizationSession.requestedLogin.minimumLevel > adjustedLevel) {
    return true;
  }

  if (authorizationSession.requestedLogin.requiredLevel > adjustedLevel) {
    return true;
  }

  if (
    difference(authorizationSession.requestedLogin.requiredMethods, browserSession.amrValues).length
  ) {
    return true;
  }

  if (authorizationSession.promptModes.includes(OauthPromptModes.LOGIN)) {
    return true;
  }

  if (isLoginRequiredByMaxAge(authorizationSession, browserSession)) {
    return true;
  }

  return false;
};
