import { AuthorizationSession } from "../../entity";

export const verifyBrowserSessions = (authorizationSession: AuthorizationSession): boolean =>
  authorizationSession.requestedSelectAccount.browserSessions.length <= 1;
