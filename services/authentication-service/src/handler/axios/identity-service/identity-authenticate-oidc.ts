import { LoginSession } from "../../../entity";
import { ServerKoaContext } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import {
  AuthenticateIdentifierRequestData,
  AuthenticateIdentifierResponseBody,
  ClientScope,
  IdentifierType,
} from "../../../common";

interface Options {
  provider: string;
  subject: string;
}

export const identityAuthenticateOidc = async (
  ctx: ServerKoaContext,
  loginSession: LoginSession,
  options: Options,
): Promise<AuthenticateIdentifierResponseBody> => {
  const {
    axios: { identityClient, oauthClient },
  } = ctx;

  const { identityId } = loginSession;
  const { provider, subject } = options;

  const body: AuthenticateIdentifierRequestData = {
    identifier: subject,
    ...(identityId ? { identityId } : {}),
    provider: provider,
    type: IdentifierType.EXTERNAL,
  };

  const { data } = await identityClient.post<AuthenticateIdentifierResponseBody>(
    "/internal/identifiers/authenticate",
    {
      data: body,
      middleware: [
        clientCredentialsMiddleware(oauthClient, [ClientScope.IDENTITY_IDENTIFIER_WRITE]),
      ],
    },
  );

  return data;
};
