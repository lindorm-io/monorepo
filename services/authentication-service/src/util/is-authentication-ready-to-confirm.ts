import { LoginSession } from "../entity";

export const isAuthenticationReadyToConfirm = (loginSession: LoginSession): boolean => {
  if (!loginSession.identityId) {
    return false;
  }

  if (loginSession.levelOfAssurance >= loginSession.requestedLevelOfAssurance) {
    return true;
  }

  if (loginSession.amrValues.length >= 2) {
    return true;
  }

  return false;
};
