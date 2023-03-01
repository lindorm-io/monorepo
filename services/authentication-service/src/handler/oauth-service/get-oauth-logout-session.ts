import { ServerKoaContext } from "../../types";
import { GetLogoutRequestParams, GetLogoutResponse } from "@lindorm-io/common-types";
import { clientCredentialsMiddleware } from "../../middleware";

export const getOauthLogoutSession = async (
  ctx: ServerKoaContext,
  id: string,
): Promise<GetLogoutResponse> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.get<GetLogoutResponse, never, unknown, GetLogoutRequestParams>(
    "/admin/sessions/logout/:id",
    {
      params: { id },
      middleware: [clientCredentialsMiddleware()],
    },
  );

  return data;
};
