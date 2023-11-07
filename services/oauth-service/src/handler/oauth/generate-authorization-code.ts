import { expiryDate } from "@lindorm-io/expiry";
import { randomUnreserved } from "@lindorm-io/random";
import { AuthorizationCode, AuthorizationSession } from "../../entity";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";

export const generateAuthorizationCode = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
): Promise<string> => {
  const {
    redis: { authorizationCodeCache },
  } = ctx;

  const code = randomUnreserved(128);

  await authorizationCodeCache.create(
    new AuthorizationCode({
      authorizationSessionId: authorizationSession.id,
      code,
      expires: expiryDate(configuration.defaults.expiry.code_session),
    }),
  );

  return code;
};
