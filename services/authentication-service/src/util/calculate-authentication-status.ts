import { AuthenticationSession } from "../entity";
import { SessionStatus } from "../common";
import { getMethodsFromStrategies } from "./get-methods-from-strategies";
import { calculateLevelOfAssurance } from "./calculate-level-of-assurance";

export const calculateAuthenticationStatus = (
  authenticationSession: AuthenticationSession,
): SessionStatus => {
  if (!authenticationSession.identityId) {
    return SessionStatus.PENDING;
  }

  const { level } = calculateLevelOfAssurance(authenticationSession);

  if (level >= authenticationSession.requestedLevel) {
    return SessionStatus.CONFIRMED;
  }

  if (getMethodsFromStrategies(authenticationSession.confirmedStrategies).length >= 2) {
    return SessionStatus.CONFIRMED;
  }

  return SessionStatus.PENDING;
};
