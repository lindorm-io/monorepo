import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { GetLoginResponse } from "@lindorm-io/common-types";
import { ClientScopes } from "../../common";

export const fetchOauthLoginData = async (
  ctx: ServerKoaContext,
  sessionId: string,
): Promise<GetLoginResponse> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.get<GetLoginResponse>("/internal/sessions/login/:id", {
    params: { id: sessionId },
    middleware: [
      clientCredentialsMiddleware(oauthClient, [ClientScopes.OAUTH_AUTHENTICATION_READ]),
    ],
  });

  return data;
};
