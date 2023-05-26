import { GetAuthorizationResponse, GetAuthorizationRequestParams } from "@lindorm-io/common-types";
import { clientCredentialsMiddleware } from "../../middleware";
import { ServerKoaContext } from "../../types";

export const getOauthAuthorizationSession = async (
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
