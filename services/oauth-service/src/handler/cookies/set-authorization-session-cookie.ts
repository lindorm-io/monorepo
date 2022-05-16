import { AUTHORIZATION_SESSION_COOKIE_NAME } from "../../constant";
import { AuthorizationSession } from "../../entity";
import { ServerKoaContext } from "../../types";

export const setAuthorizationSessionCookie = (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
): void => {
  ctx.setCookie(AUTHORIZATION_SESSION_COOKIE_NAME, authorizationSession.id, {
    expiry: authorizationSession.expires,
  });
};
