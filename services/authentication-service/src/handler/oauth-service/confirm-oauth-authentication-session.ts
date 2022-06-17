import { ConfirmAuthenticationRequestBody, ResponseWithRedirectBody } from "../../common";
import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";

export const confirmOauthAuthenticationSession = async (
  ctx: ServerKoaContext,
  sessionId: string,
  body: ConfirmAuthenticationRequestBody,
): Promise<ResponseWithRedirectBody> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.put<ResponseWithRedirectBody>(
    "/internal/sessions/authentication/:id/confirm",
    {
      body,
      params: { id: sessionId },
      middleware: [clientCredentialsMiddleware(oauthClient)],
    },
  );

  return data;
};
