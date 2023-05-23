import { GetClaimsRequestRequestParams, GetClaimsRequestResponse } from "@lindorm-io/common-types";
import { clientCredentialsMiddleware } from "../../middleware";
import { ServerKoaContext } from "../../types";

export const getOauthClaimsRequest = async (
  ctx: ServerKoaContext,
  id: string,
): Promise<GetClaimsRequestResponse> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.get<
    GetClaimsRequestResponse,
    never,
    unknown,
    GetClaimsRequestRequestParams
  >("/admin/sessions/claims/:id", {
    params: { id },
    middleware: [clientCredentialsMiddleware()],
  });

  return data;
};
