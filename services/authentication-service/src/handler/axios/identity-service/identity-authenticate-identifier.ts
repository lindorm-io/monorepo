import { LoginSession, FlowSession } from "../../../entity";
import { ServerKoaContext } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import {
  AuthenticateIdentifierRequestData,
  AuthenticateIdentifierResponseBody,
  ClientScope,
  IdentifierType,
} from "../../../common";

export const identityAuthenticateIdentifier = async (
  ctx: ServerKoaContext,
  loginSession: LoginSession,
  flowSession: FlowSession,
): Promise<AuthenticateIdentifierResponseBody> => {
  const {
    axios: { identityClient, oauthClient },
  } = ctx;

  const { identityId } = loginSession;
  const { email, nin, phoneNumber, username } = flowSession;

  const body: AuthenticateIdentifierRequestData = {
    identifier: email || nin || phoneNumber || username,
    ...(identityId ? { identityId } : {}),
    type: IdentifierType.EMAIL,

    ...(email ? { type: IdentifierType.EMAIL } : {}),
    ...(nin ? { type: IdentifierType.NIN } : {}),
    ...(phoneNumber ? { type: IdentifierType.PHONE } : {}),
    ...(username ? { type: IdentifierType.USERNAME } : {}),
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
