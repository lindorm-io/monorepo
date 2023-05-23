import { difference } from "lodash";
import { AuthorizationRequest, BrowserSession, ClientSession } from "../../entity";

export const verifyRequiredMethods = (
  authorizationRequest: AuthorizationRequest,
  session: BrowserSession | ClientSession,
): boolean => {
  if (!authorizationRequest.requestedLogin.requiredMethods.length) return true;
  if (!session.methods.length) return false;

  return !difference(authorizationRequest.requestedLogin.requiredMethods, session.methods).length;
};
