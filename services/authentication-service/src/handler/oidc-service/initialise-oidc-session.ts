import { InitialiseOidcSessionRequestData, InitialiseOidcSessionResponseBody } from "../../common";
import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";

export const initialiseOidcSession = async (
  ctx: ServerKoaContext,
  body: InitialiseOidcSessionRequestData,
): Promise<InitialiseOidcSessionResponseBody> => {
  const {
    axios: { oauthClient, oidcClient },
  } = ctx;

  const { data } = await oidcClient.post<InitialiseOidcSessionResponseBody>("/internal/sessions", {
    body,
    middleware: [clientCredentialsMiddleware(oauthClient)],
  });

  return data;
};
