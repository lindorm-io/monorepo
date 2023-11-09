import { AuthenticationFactor } from "@lindorm-io/common-enums";

export const getPrimaryFactor = (factors: Array<AuthenticationFactor>): AuthenticationFactor => {
  if (factors.includes(AuthenticationFactor.PHISHING_RESISTANT_HARDWARE)) {
    return AuthenticationFactor.PHISHING_RESISTANT_HARDWARE;
  }
  if (factors.includes(AuthenticationFactor.TWO_FACTOR)) {
    return AuthenticationFactor.TWO_FACTOR;
  }
  if (factors.includes(AuthenticationFactor.PHISHING_RESISTANT)) {
    return AuthenticationFactor.PHISHING_RESISTANT;
  }
  return AuthenticationFactor.ONE_FACTOR;
};
