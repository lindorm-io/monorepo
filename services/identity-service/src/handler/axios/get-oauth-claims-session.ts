import { GetClaimsSessionRequestParams, GetClaimsSessionResponse } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";

export const getOauthClaimsSession = async (
  ctx: ServerKoaContext,
  id: string,
): Promise<GetClaimsSessionResponse> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.get<
    GetClaimsSessionResponse,
    never,
    unknown,
    GetClaimsSessionRequestParams
  >("/admin/sessions/claims/:id", {
    params: { id },
    middleware: [clientCredentialsMiddleware(oauthClient)],
  });

  return data;
};
