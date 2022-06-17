import { ResponseWithRedirectBody } from "../../common";
import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";

export const skipOauthAuthenticationSession = async (
  ctx: ServerKoaContext,
  sessionId: string,
): Promise<ResponseWithRedirectBody> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.put<ResponseWithRedirectBody>(
    "/internal/sessions/authentication/:id/skip",
    {
      params: { id: sessionId },
      middleware: [clientCredentialsMiddleware(oauthClient)],
    },
  );

  return data;
};
