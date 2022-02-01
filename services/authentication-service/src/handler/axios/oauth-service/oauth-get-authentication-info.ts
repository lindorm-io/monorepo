import { Context } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { ClientScope, GetAuthenticationInfoResponseBody } from "../../../common";

export const oauthGetAuthenticationInfo = async (
  ctx: Context,
  sessionId: string,
): Promise<GetAuthenticationInfoResponseBody> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.get<GetAuthenticationInfoResponseBody>(
    "/internal/sessions/authentication/:id",
    {
      params: { id: sessionId },
      middleware: [
        clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_AUTHENTICATION_READ]),
      ],
    },
  );

  return data;
};
