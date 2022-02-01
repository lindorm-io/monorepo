import { ClientScope, ResponseWithRedirectBody } from "../../../common";
import { Context } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";

export const oauthSkipAuthentication = async (
  ctx: Context,
  sessionId: string,
): Promise<ResponseWithRedirectBody> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.put<ResponseWithRedirectBody>(
    "/internal/sessions/authentication/:id/skip",
    {
      params: { id: sessionId },
      middleware: [
        clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_AUTHENTICATION_WRITE]),
      ],
    },
  );

  return data;
};
