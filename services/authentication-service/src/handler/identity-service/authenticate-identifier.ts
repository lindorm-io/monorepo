import { AuthenticationSession, StrategySession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { removeEmptyFromObject } from "@lindorm-io/core";
import { ClientScopes } from "../../common";
import {
  AuthenticateIdentifierRequestBody,
  AuthenticateIdentifierResponse,
  IdentifierTypes,
} from "@lindorm-io/common-types";

export const authenticateIdentifier = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
): Promise<AuthenticateIdentifierResponse> => {
  const {
    axios: { identityClient, oauthClient },
  } = ctx;

  const { identityId } = authenticationSession;
  const { email, nin, phoneNumber, username } = strategySession;

  const body: AuthenticateIdentifierRequestBody = removeEmptyFromObject({
    identifier: email || nin || phoneNumber || username,
    identityId,
    type: IdentifierTypes.EMAIL,

    ...(email ? { type: IdentifierTypes.EMAIL } : {}),
    ...(nin ? { type: IdentifierTypes.NIN } : {}),
    ...(phoneNumber ? { type: IdentifierTypes.PHONE } : {}),
    ...(username ? { type: IdentifierTypes.USERNAME } : {}),
  });

  const { data } = await identityClient.post<AuthenticateIdentifierResponse>(
    "/internal/authenticate",
    {
      body,
      middleware: [
        clientCredentialsMiddleware(oauthClient, [ClientScopes.IDENTITY_IDENTIFIER_WRITE]),
      ],
    },
  );

  return data;
};
