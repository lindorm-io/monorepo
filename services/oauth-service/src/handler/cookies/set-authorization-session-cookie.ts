import { ServerKoaContext } from "../../types";
import { AuthorizationSession } from "../../entity";
import { AUTHORIZATION_SESSION_COOKIE_NAME, BROWSER_SESSIONS_COOKIE_NAME } from "../../constant";
import { Environment } from "@lindorm-io/common-types";

export const setAuthorizationSessionCookie = (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
): void => {
  const {
    cookies,
    logger,
    server: { environment },
  } = ctx;

  const value = authorizationSession.id;
  const opts = {
    expires: authorizationSession.expires,
    httpOnly: true,
    overwrite: true,
    signed: environment !== Environment.TEST,
  };

  logger.verbose("Setting cookie", {
    name: BROWSER_SESSIONS_COOKIE_NAME,
    value,
    opts,
  });

  cookies.set(AUTHORIZATION_SESSION_COOKIE_NAME, authorizationSession.id, {
    expires: authorizationSession.expires,
    httpOnly: true,
    overwrite: true,
    signed: environment !== Environment.TEST,
  });
};
