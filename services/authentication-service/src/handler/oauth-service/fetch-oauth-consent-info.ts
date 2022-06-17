import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { GetConsentInfoResponseBody } from "../../common";

export const fetchOauthConsentInfo = async (
  ctx: ServerKoaContext,
  sessionId: string,
): Promise<GetConsentInfoResponseBody> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.get<GetConsentInfoResponseBody>(
    "/internal/sessions/consent/:id",
    {
      params: { id: sessionId },
      middleware: [clientCredentialsMiddleware(oauthClient)],
    },
  );

  return data;
};
