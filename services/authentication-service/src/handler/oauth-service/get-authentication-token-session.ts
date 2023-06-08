import {
  GetAuthenticationTokenSessionRequestParams,
  GetAuthenticationTokenSessionResponse,
} from "@lindorm-io/common-types";
import { clientCredentialsMiddleware } from "../../middleware";
import { ServerKoaContext } from "../../types";

export const getOauthAuthenticationTokenSession = async (
  ctx: ServerKoaContext,
  id: string,
): Promise<GetAuthenticationTokenSessionResponse> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.get<
    GetAuthenticationTokenSessionResponse,
    never,
    unknown,
    GetAuthenticationTokenSessionRequestParams
  >("/admin/sessions/authentication-token/:id", {
    params: { id },
    middleware: [clientCredentialsMiddleware()],
  });

  return data;
};
