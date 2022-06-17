import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { GetAuthenticationInfoResponseBody } from "../../common";

export const fetchOauthAuthenticationInfo = async (
  ctx: ServerKoaContext,
  sessionId: string,
): Promise<GetAuthenticationInfoResponseBody> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.get<GetAuthenticationInfoResponseBody>(
    "/internal/sessions/authentication/:id",
    {
      params: { id: sessionId },
      middleware: [clientCredentialsMiddleware(oauthClient)],
    },
  );

  return data;
};
