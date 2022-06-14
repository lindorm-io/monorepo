import { ClientScope, ResponseWithRedirectBody } from "../../common";
import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";

export const rejectOauthAuthenticationSession = async (
  ctx: ServerKoaContext,
  sessionId: string,
): Promise<ResponseWithRedirectBody> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.put<ResponseWithRedirectBody>(
    "/internal/sessions/authentication/:id/reject",
    {
      params: { id: sessionId },
      middleware: [
        clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_AUTHENTICATION_WRITE]),
      ],
    },
  );

  return data;
};
