import { ServerKoaContext } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { ClientScope, GetConsentInfoResponseBody } from "../../../common";

export const oauthGetConsentInfo = async (
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
      middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_CONSENT_READ])],
    },
  );

  return data;
};
