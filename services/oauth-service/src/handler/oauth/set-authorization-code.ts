import { AuthorizationSession } from "../../entity";
import { Context } from "../../types";
import { configuration } from "../../configuration";
import { getExpires, getRandomString } from "@lindorm-io/core";

export const setAuthorizationCode = async (
  ctx: Context,
  authorizationSession: AuthorizationSession,
): Promise<AuthorizationSession> => {
  const {
    cache: { authorizationSessionCache },
  } = ctx;

  const { expires, expiresIn } = getExpires(configuration.expiry.code_session);

  authorizationSession.code = getRandomString(128);
  authorizationSession.expires = expires;

  return await authorizationSessionCache.update(authorizationSession, expiresIn);
};
