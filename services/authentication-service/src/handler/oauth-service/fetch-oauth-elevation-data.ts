import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { GetElevationResponse } from "@lindorm-io/common-types";
import { ClientScopes } from "../../common";

export const fetchOauthElevationData = async (
  ctx: ServerKoaContext,
  sessionId: string,
): Promise<GetElevationResponse> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.get<GetElevationResponse>("/internal/sessions/elevation/:id", {
    params: { id: sessionId },
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScopes.OAUTH_ELEVATION_READ])],
  });

  return data;
};
