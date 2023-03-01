import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { RedirectLogoutRequestParams, RedirectLogoutResponse } from "@lindorm-io/common-types";

export const getOauthLogoutRedirect = async (
  ctx: ServerKoaContext,
  id: string,
): Promise<RedirectLogoutResponse> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.get<
    RedirectLogoutResponse,
    never,
    unknown,
    RedirectLogoutRequestParams
  >("/admin/sessions/logout/:id/redirect", {
    params: { id },
    middleware: [clientCredentialsMiddleware()],
  });

  return data;
};
