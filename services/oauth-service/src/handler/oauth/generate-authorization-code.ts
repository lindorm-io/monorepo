import { AuthorizationCode, AuthorizationSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { expiryDate } from "@lindorm-io/expiry";
import { randomString } from "@lindorm-io/random";

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
      expires: expiryDate(configuration.defaults.expiry.code_session),
    }),
  );
};
