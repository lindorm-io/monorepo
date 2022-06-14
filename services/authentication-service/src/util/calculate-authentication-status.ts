import { AuthenticationSession } from "../entity";
import { SessionStatus } from "../common";

export const calculateAuthenticationStatus = (
  authenticationSession: AuthenticationSession,
): SessionStatus => {
  if (!authenticationSession.identityId) {
    return SessionStatus.PENDING;
  }

  if (
    authenticationSession.confirmedLevelOfAssurance >=
    authenticationSession.requestedLevelOfAssurance
  ) {
    return SessionStatus.CONFIRMED;
  }

  if (authenticationSession.confirmedMethods.length >= 2) {
    return SessionStatus.CONFIRMED;
  }

  return SessionStatus.PENDING;
};
