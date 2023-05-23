import { AuthorizationRequest } from "../../entity";

export const verifyBrowserSessions = (authorizationRequest: AuthorizationRequest): boolean =>
  authorizationRequest.requestedSelectAccount.browserSessions.length <= 1;
