import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { ConfirmConsentRequestBody, ResponseWithRedirectBody } from "../../common";

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
      body,
      params: { id: sessionId },
      middleware: [clientCredentialsMiddleware(oauthClient)],
    },
  );

  return data;
};
