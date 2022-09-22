import { OidcSession } from "../entity";
import { ServerKoaContext } from "../types";
import { clientCredentialsMiddleware } from "../middleware";
import { removeEmptyFromObject } from "@lindorm-io/core";
import {
  AuthenticateIdentifierRequestData,
  AuthenticateIdentifierResponseBody,
  ClientScope,
  IdentifierType,
} from "../common";

interface Options {
  provider: string;
  subject: string;
}

export const axiosAuthenticateOidcIdentity = async (
  ctx: ServerKoaContext,
  oidcSession: OidcSession,
  options: Options,
): Promise<AuthenticateIdentifierResponseBody> => {
  const {
    axios: { identityClient, oauthClient },
  } = ctx;

  const { identityId } = oidcSession;
  const { provider, subject } = options;

  const body: AuthenticateIdentifierRequestData = removeEmptyFromObject({
    identifier: subject,
    identityId,
    provider,
    type: IdentifierType.EXTERNAL,
  });

  const { data } = await identityClient.post<AuthenticateIdentifierResponseBody>(
    "/internal/authenticate",
    {
      body,
      middleware: [
        clientCredentialsMiddleware(oauthClient, [ClientScope.IDENTITY_IDENTIFIER_WRITE]),
      ],
    },
  );

  return data;
};
