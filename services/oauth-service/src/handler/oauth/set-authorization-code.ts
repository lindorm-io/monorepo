import { AuthorizationSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { getExpires, getRandomString } from "@lindorm-io/core";

export const setAuthorizationCode = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
): Promise<AuthorizationSession> => {
  const {
    cache: { authorizationSessionCache },
  } = ctx;

  const { expires, expiresIn } = getExpires(configuration.defaults.expiry.code_session);

  authorizationSession.code = getRandomString(128);
  authorizationSession.expires = expires;

  return await authorizationSessionCache.update(authorizationSession, expiresIn);
};
