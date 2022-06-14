import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { ClientScope, ConfirmConsentRequestBody, ResponseWithRedirectBody } from "../../common";

export const confirmOauthConsentSession = async (
  ctx: ServerKoaContext,
  sessionId: string,
  body: ConfirmConsentRequestBody,
): Promise<ResponseWithRedirectBody> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.put<ResponseWithRedirectBody>(
    "/internal/sessions/consent/:id/confirm",
    {
      params: { id: sessionId },
      data: body,
      middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_CONSENT_WRITE])],
    },
  );

  return data;
};
