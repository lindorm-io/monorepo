import { ClientScope, ResponseWithRedirectBody } from "../../../common";
import { Context } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";

export const oauthConfirmLogout = async (
  ctx: Context,
  sessionId: string,
): Promise<ResponseWithRedirectBody> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.put<ResponseWithRedirectBody>(
    "/internal/sessions/logout/:id/confirm",
    {
      params: { id: sessionId },
      middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_LOGOUT_WRITE])],
    },
  );

  return data;
};
