import {
  GetElevationSessionRequestParams,
  GetElevationSessionResponse,
} from "@lindorm-io/common-types";
import { clientCredentialsMiddleware } from "../../middleware";
import { ServerKoaContext } from "../../types";

export const getOauthElevationSession = async (
  ctx: ServerKoaContext,
  id: string,
): Promise<GetElevationSessionResponse> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.get<
    GetElevationSessionResponse,
    never,
    unknown,
    GetElevationSessionRequestParams
  >("/admin/sessions/elevation/:id", {
    params: { id },
    middleware: [clientCredentialsMiddleware()],
  });

  return data;
};
