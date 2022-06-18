import { AuthorizationSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { getExpiryDate, randomString } from "@lindorm-io/core";

export const setAuthorizationCode = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
): Promise<AuthorizationSession> => {
  const {
    cache: { authorizationSessionCache },
  } = ctx;

  const expires = getExpiryDate(configuration.defaults.expiry.code_session);

  authorizationSession.code = randomString(128);
  authorizationSession.expires = expires;

  return await authorizationSessionCache.update(authorizationSession);
};
