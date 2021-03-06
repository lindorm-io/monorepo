import { AuthenticationSession, StrategySession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { removeEmptyFromObject } from "@lindorm-io/core";
import {
  AuthenticateIdentifierRequestData,
  AuthenticateIdentifierResponseBody,
  IdentifierType,
} from "../../common";

export const authenticateIdentifier = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
): Promise<AuthenticateIdentifierResponseBody> => {
  const {
    axios: { identityClient, oauthClient },
  } = ctx;

  const { identityId } = authenticationSession;
  const { email, nin, phoneNumber, username } = strategySession;

  const body: AuthenticateIdentifierRequestData = removeEmptyFromObject({
    identifier: email || nin || phoneNumber || username,
    identityId,
    type: IdentifierType.EMAIL,

    ...(email ? { type: IdentifierType.EMAIL } : {}),
    ...(nin ? { type: IdentifierType.NIN } : {}),
    ...(phoneNumber ? { type: IdentifierType.PHONE } : {}),
    ...(username ? { type: IdentifierType.USERNAME } : {}),
  });

  const { data } = await identityClient.post<AuthenticateIdentifierResponseBody>(
    "/internal/identifiers/authenticate",
    {
      body,
      middleware: [clientCredentialsMiddleware(oauthClient)],
    },
  );

  return data;
};
