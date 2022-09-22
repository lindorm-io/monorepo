import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { ClientScope, GetElevationDataResponseBody } from "../../common";

export const fetchOauthElevationData = async (
  ctx: ServerKoaContext,
  sessionId: string,
): Promise<GetElevationDataResponseBody> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.get<GetElevationDataResponseBody>(
    "/internal/sessions/elevation/:id",
    {
      params: { id: sessionId },
      middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_ELEVATION_READ])],
    },
  );

  return data;
};
