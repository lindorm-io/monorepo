import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import {
  RedirectAuthorizationRequestParams,
  RedirectAuthorizationResponse,
} from "@lindorm-io/common-types";

export const getOauthAuthorizationRedirect = async (
  ctx: ServerKoaContext,
  id: string,
): Promise<RedirectAuthorizationResponse> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.get<
    RedirectAuthorizationResponse,
    never,
    unknown,
    RedirectAuthorizationRequestParams
  >("/admin/sessions/authorization/:id/redirect", {
    params: { id },
    middleware: [clientCredentialsMiddleware()],
  });

  return data;
};
