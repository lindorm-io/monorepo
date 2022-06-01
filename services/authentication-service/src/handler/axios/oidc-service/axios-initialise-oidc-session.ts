import { LoginSession } from "../../../entity";
import { ServerKoaContext } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { configuration } from "../../../server/configuration";
import { createURL } from "@lindorm-io/core";
import {
  ClientScope,
  InitialiseOidcSessionRequestData,
  InitialiseOidcSessionResponseBody,
} from "../../../common";

export const axiosInitialiseOidcSession = async (
  ctx: ServerKoaContext,
  loginSession: LoginSession,
  provider: string,
): Promise<InitialiseOidcSessionResponseBody> => {
  const {
    axios: { oauthClient, oidcClient },
  } = ctx;

  const body: InitialiseOidcSessionRequestData = {
    callbackUri: createURL("/sessions/login/oidc/callback", {
      host: configuration.server.host,
      port: configuration.server.port,
    }).toString(),
    expiresAt: loginSession.expires.toISOString(),
    loginHint: loginSession.loginHint.length ? loginSession.loginHint[0] : undefined,
    provider,
  };

  const { data } = await oidcClient.post<InitialiseOidcSessionResponseBody>("/internal/sessions", {
    data: body,
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.OIDC_SESSION_WRITE])],
  });

  return data;
};
