import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import {
  ClientScope,
  InitialiseOidcSessionRequestData,
  InitialiseOidcSessionResponseBody,
} from "../../common";

export const initialiseOidcSession = async (
  ctx: ServerKoaContext,
  body: InitialiseOidcSessionRequestData,
): Promise<InitialiseOidcSessionResponseBody> => {
  const {
    axios: { oauthClient, oidcClient },
  } = ctx;

  const { data } = await oidcClient.post<InitialiseOidcSessionResponseBody>("/internal/sessions", {
    body,
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.OIDC_SESSION_WRITE])],
  });

  return data;
};
