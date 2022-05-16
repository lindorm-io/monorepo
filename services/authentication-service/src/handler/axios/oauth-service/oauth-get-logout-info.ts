import { ClientScope, GetLogoutSessionInfoResponseBody } from "../../../common";
import { ServerKoaContext } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";

export const oauthGetLogoutSessionInfo = async (
  ctx: ServerKoaContext,
  sessionId: string,
): Promise<GetLogoutSessionInfoResponseBody> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.get<GetLogoutSessionInfoResponseBody>(
    "/internal/sessions/logout/:id",
    {
      params: { id: sessionId },
      middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_LOGOUT_READ])],
    },
  );

  return data;
};
