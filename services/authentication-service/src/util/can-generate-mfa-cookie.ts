import { AuthenticationSession } from "../entity";
import { findMethodConfiguration } from "./find-method-configuration";

export const canGenerateMfaCookie = (authenticationSession: AuthenticationSession): boolean => {
  if (authenticationSession.confirmedMethods.length < 2) {
    return false;
  }

  for (const method of authenticationSession.confirmedMethods) {
    if (findMethodConfiguration(method).mfaCookie) {
      return true;
    }
  }

  return false;
};
