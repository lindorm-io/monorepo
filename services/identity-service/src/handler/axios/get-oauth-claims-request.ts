import { GetClaimsSessionRequestParams, GetClaimsSessionResponse } from "@lindorm-io/common-types";
import { clientCredentialsMiddleware } from "../../middleware";
import { ServerKoaContext } from "../../types";

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
    middleware: [clientCredentialsMiddleware()],
  });

  return data;
};
