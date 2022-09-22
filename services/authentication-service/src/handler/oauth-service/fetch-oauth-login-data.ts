import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { ClientScope, GetLoginDataResponseBody } from "../../common";

export const fetchOauthLoginData = async (
  ctx: ServerKoaContext,
  sessionId: string,
): Promise<GetLoginDataResponseBody> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.get<GetLoginDataResponseBody>("/internal/sessions/login/:id", {
    params: { id: sessionId },
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_AUTHENTICATION_READ])],
  });

  return data;
};
