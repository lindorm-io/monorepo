import { SessionStatus } from "@lindorm-io/common-types";
import { Account, AuthenticationSession } from "../entity";
import { calculateLevelOfAssurance } from "./calculate-level-of-assurance";
import { getMethodsFromStrategies } from "./get-methods-from-strategies";

export const calculateAuthenticationStatus = (
  authenticationSession: AuthenticationSession,
  account?: Account,
): SessionStatus => {
  if (!authenticationSession.identityId) {
    return SessionStatus.PENDING;
  }

  if (!account) {
    return SessionStatus.PENDING;
  }

  const methods = getMethodsFromStrategies(authenticationSession);

  for (const method of authenticationSession.requiredMethods) {
    if (methods.includes(method)) continue;
    return SessionStatus.PENDING;
  }

  for (const strategy of authenticationSession.requiredStrategies) {
    if (authenticationSession.confirmedStrategies.includes(strategy)) continue;
    return SessionStatus.PENDING;
  }

  const { level } = calculateLevelOfAssurance(authenticationSession);

  if (level < authenticationSession.minimumLevel) {
    return SessionStatus.PENDING;
  }

  if (level < authenticationSession.requiredLevel) {
    return SessionStatus.PENDING;
  }

  if (account.requireMfa && methods.length < 2) {
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
