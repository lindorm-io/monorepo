import { expiryDate } from "@lindorm-io/expiry";
import { randomUnreserved } from "@lindorm-io/random";
import { AuthorizationCode, AuthorizationRequest } from "../../entity";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";

export const generateAuthorizationCode = async (
  ctx: ServerKoaContext,
  authorizationRequest: AuthorizationRequest,
): Promise<string> => {
  const {
    redis: { authorizationCodeCache },
  } = ctx;

  const code = randomUnreserved(128);

  await authorizationCodeCache.create(
    new AuthorizationCode({
      AuthorizationRequestId: authorizationRequest.id,
      code,
      expires: expiryDate(configuration.defaults.expiry.code_session),
    }),
  );

  return code;
};
