import { ClientScope, ResponseWithRedirectBody } from "../../../common";
import { Context } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";

export const oauthRejectConsent = async (
  ctx: Context,
  sessionId: string,
): Promise<ResponseWithRedirectBody> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.put<ResponseWithRedirectBody>(
    "/internal/sessions/consent/:id/reject",
    {
      params: { id: sessionId },
      middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_CONSENT_WRITE])],
    },
  );

  return data;
};
