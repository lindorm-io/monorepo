import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import {
  ClientScope,
  ConfirmAuthenticationRequestBody,
  ResponseWithRedirectBody,
} from "../../common";

export const confirmOauthAuthenticationSession = async (
  ctx: ServerKoaContext,
  sessionId: string,
  body: ConfirmAuthenticationRequestBody,
): Promise<ResponseWithRedirectBody> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.put<ResponseWithRedirectBody>(
    "/internal/sessions/authentication/:id/confirm",
    {
      body,
      params: { id: sessionId },
      middleware: [
        clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_AUTHENTICATION_WRITE]),
      ],
    },
  );

  return data;
};
