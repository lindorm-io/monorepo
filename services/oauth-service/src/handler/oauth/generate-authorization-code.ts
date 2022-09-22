import { AuthorizationCode, AuthorizationSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { getExpiryDate, randomString } from "@lindorm-io/core";

export const generateAuthorizationCode = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
): Promise<AuthorizationCode> => {
  const {
    cache: { authorizationCodeCache },
  } = ctx;

  return await authorizationCodeCache.create(
    new AuthorizationCode({
      authorizationSessionId: authorizationSession.id,
      code: randomString(128),
      expires: getExpiryDate(configuration.defaults.expiry.code_session),
    }),
  );
};
