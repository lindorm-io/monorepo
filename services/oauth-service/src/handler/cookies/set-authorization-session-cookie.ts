import { AUTHORIZATION_SESSION_COOKIE_NAME } from "../../constant";
import { AuthorizationSession } from "../../entity";
import { Context } from "../../types";

export const setAuthorizationSessionCookie = (
  ctx: Context,
  authorizationSession: AuthorizationSession,
): void => {
  ctx.setCookie(AUTHORIZATION_SESSION_COOKIE_NAME, authorizationSession.id, {
    expiry: authorizationSession.expires,
  });
};
