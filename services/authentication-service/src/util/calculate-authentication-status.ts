import { AuthenticationSession } from "../entity";
import { SessionStatus } from "../common";
import { calculateLevelOfAssurance } from "./calculate-level-of-assurance";
import { getMethodsFromStrategies } from "./get-methods-from-strategies";

export const calculateAuthenticationStatus = (
  authenticationSession: AuthenticationSession,
): SessionStatus => {
  if (!authenticationSession.identityId) {
    return SessionStatus.PENDING;
  }

  const methods = getMethodsFromStrategies(authenticationSession.confirmedStrategies);

  for (const method of authenticationSession.requiredMethods) {
    if (methods.includes(method)) continue;
    return SessionStatus.PENDING;
  }

  const { level } = calculateLevelOfAssurance(authenticationSession);

  if (level < authenticationSession.minimumLevel) {
    return SessionStatus.PENDING;
  }

  if (level < authenticationSession.requiredLevel) {
    return SessionStatus.PENDING;
  }

  if (methods.length >= 2) {
    return SessionStatus.CONFIRMED;
  }

  if (level >= authenticationSession.recommendedLevel) {
    return SessionStatus.CONFIRMED;
  }

  return SessionStatus.PENDING;
};
