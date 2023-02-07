import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { GetLogoutResponse } from "@lindorm-io/common-types";
import { ClientScopes } from "../../common";

export const fetchOauthLogoutData = async (
  ctx: ServerKoaContext,
  sessionId: string,
): Promise<GetLogoutResponse> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.get<GetLogoutResponse>("/internal/sessions/logout/:id", {
    params: { id: sessionId },
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScopes.OAUTH_LOGOUT_READ])],
  });

  return data;
};
