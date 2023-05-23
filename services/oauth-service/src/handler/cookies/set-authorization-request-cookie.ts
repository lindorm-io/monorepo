import { Environment } from "@lindorm-io/common-types";
import { AUTHORIZATION_SESSION_COOKIE_NAME, BROWSER_SESSIONS_COOKIE_NAME } from "../../constant";
import { AuthorizationRequest } from "../../entity";
import { ServerKoaContext } from "../../types";

export const setAuthorizationRequestCookie = (
  ctx: ServerKoaContext,
  authorizationRequest: AuthorizationRequest,
): void => {
  const {
    cookies,
    logger,
    server: { environment },
  } = ctx;

  const value = authorizationRequest.id;
  const opts = {
    expires: authorizationRequest.expires,
    httpOnly: true,
    overwrite: true,
    signed: environment !== Environment.TEST,
  };

  logger.verbose("Setting cookie", {
    name: BROWSER_SESSIONS_COOKIE_NAME,
    value,
    opts,
  });

  cookies.set(AUTHORIZATION_SESSION_COOKIE_NAME, authorizationRequest.id, {
    expires: authorizationRequest.expires,
    httpOnly: true,
    overwrite: true,
    signed: environment !== Environment.TEST,
  });
};
