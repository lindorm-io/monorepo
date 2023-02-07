import { AuthenticationSession } from "../entity";
import { calculateLevelOfAssurance } from "./calculate-level-of-assurance";
import { getMethodsFromStrategies } from "./get-methods-from-strategies";
import { SessionStatus, SessionStatuses } from "@lindorm-io/common-types";

export const calculateAuthenticationStatus = (
  authenticationSession: AuthenticationSession,
): SessionStatus => {
  if (!authenticationSession.identityId) {
    return SessionStatuses.PENDING;
  }

  const methods = getMethodsFromStrategies(authenticationSession.confirmedStrategies);

  for (const method of authenticationSession.requiredMethods) {
    if (methods.includes(method)) continue;
    return SessionStatuses.PENDING;
  }

  const { level } = calculateLevelOfAssurance(authenticationSession);

  if (level < authenticationSession.minimumLevel) {
    return SessionStatuses.PENDING;
  }

  if (level < authenticationSession.requiredLevel) {
    return SessionStatuses.PENDING;
  }

  if (methods.length >= 2) {
    return SessionStatuses.CONFIRMED;
  }

  if (level >= authenticationSession.recommendedLevel) {
    return SessionStatuses.CONFIRMED;
  }

  return SessionStatuses.PENDING;
};
