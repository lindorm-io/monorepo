import { OidcSession } from "../entity";
import { ServerKoaContext } from "../types";
import { clientCredentialsMiddleware } from "../middleware";
import { removeEmptyFromObject } from "@lindorm-io/core";
import { ClientScopes } from "../common";
import {
  AuthenticateIdentifierRequestBody,
  AuthenticateIdentifierResponse,
  IdentifierTypes,
} from "@lindorm-io/common-types";

type Options = {
  provider: string;
  subject: string;
};

export const axiosAuthenticateOidcIdentity = async (
  ctx: ServerKoaContext,
  oidcSession: OidcSession,
  options: Options,
): Promise<AuthenticateIdentifierResponse> => {
  const {
    axios: { identityClient, oauthClient },
  } = ctx;

  const { identityId } = oidcSession;
  const { provider, subject } = options;

  const body: AuthenticateIdentifierRequestBody = removeEmptyFromObject({
    identifier: subject,
    identityId,
    provider,
    type: IdentifierTypes.EXTERNAL,
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
