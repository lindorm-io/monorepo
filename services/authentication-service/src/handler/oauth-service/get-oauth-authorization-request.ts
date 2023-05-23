import { GetAuthorizationRequestParams, GetAuthorizationResponse } from "@lindorm-io/common-types";
import { clientCredentialsMiddleware } from "../../middleware";
import { ServerKoaContext } from "../../types";

export const getOauthAuthorizationRequest = async (
  ctx: ServerKoaContext,
  id: string,
): Promise<GetAuthorizationResponse> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.get<
    GetAuthorizationResponse,
    never,
    unknown,
    GetAuthorizationRequestParams
  >("/admin/sessions/authorization/:id", {
    params: { id },
    middleware: [clientCredentialsMiddleware()],
  });

  return data;
};
