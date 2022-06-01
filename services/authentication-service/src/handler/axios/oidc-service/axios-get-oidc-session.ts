import { ClientScope, GetOidcSessionResponseBody } from "../../../common";
import { ServerKoaContext } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";

export const axiosGetOidcSession = async (
  ctx: ServerKoaContext,
  sessionId: string,
): Promise<GetOidcSessionResponseBody> => {
  const {
    axios: { oauthClient, oidcClient },
  } = ctx;

  const { data } = await oidcClient.get<GetOidcSessionResponseBody>("/internal/sessions/:id", {
    params: { id: sessionId },
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.OIDC_SESSION_READ])],
  });

  return data;
};
