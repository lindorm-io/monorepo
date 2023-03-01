import { ServerKoaContext } from "../../types";
import { GetElevationRequestParams, GetElevationResponse } from "@lindorm-io/common-types";
import { clientCredentialsMiddleware } from "../../middleware";

export const getOauthElevationSession = async (
  ctx: ServerKoaContext,
  id: string,
): Promise<GetElevationResponse> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.get<
    GetElevationResponse,
    never,
    unknown,
    GetElevationRequestParams
  >("/admin/sessions/elevation/:id", {
    params: { id },
    middleware: [clientCredentialsMiddleware()],
  });

  return data;
};
