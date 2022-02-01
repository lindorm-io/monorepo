import { Context } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { ClientScope, ConfirmConsentRequestBody, ResponseWithRedirectBody } from "../../../common";

interface Options extends ConfirmConsentRequestBody {
  sessionId: string;
}

export const oauthConfirmConsent = async (
  ctx: Context,
  options: Options,
): Promise<ResponseWithRedirectBody> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { audiences, scopes, sessionId } = options;

  const { data } = await oauthClient.put<ResponseWithRedirectBody>(
    "/internal/sessions/consent/:id/confirm",
    {
      params: { id: sessionId },
      data: { audiences, scopes },
      middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_CONSENT_WRITE])],
    },
  );

  return data;
};
