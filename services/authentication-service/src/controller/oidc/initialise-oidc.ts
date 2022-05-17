import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { OIDC_SESSION_COOKIE_NAME } from "../../constant";
import { OidcSession } from "../../entity";
import { ResponseMode } from "../../common";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { createHash } from "crypto";
import { createURL, getExpires, getRandomString, PKCEMethod } from "@lindorm-io/core";
import { find } from "lodash";

interface RequestData {
  identityProvider: string;
  remember: boolean;
}

export const initialiseOidcSchema = Joi.object<RequestData>({
  identityProvider: Joi.string().required(),
  remember: Joi.boolean().required(),
});

export const initialiseOidcController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { loginSessionCache, oidcSessionCache },
    data: { identityProvider, remember },
    entity: { loginSession },
  } = ctx;

  const { authorize_endpoint, base_url, client_id, response_type, scope } =
    find(configuration.oidc_providers, { key: identityProvider }) || {};

  if (!client_id) {
    throw new ClientError("Unable to find identity provider configuration");
  }

  const { expiresIn } = getExpires(loginSession.expires);

  const oidcSession = await oidcSessionCache.create(
    new OidcSession({
      codeVerifier: getRandomString(32),
      expires: loginSession.expires,
      identityProvider: identityProvider,
      loginSessionId: loginSession.id,
      nonce: getRandomString(16),
      redirectUri: createURL("/sessions/login/oidc", {
        host: configuration.frontend.host,
        port: configuration.frontend.port,
      }).toString(),
      scope: scope,
      state: getRandomString(48),
    }),
    expiresIn,
  );

  const redirectTo = createURL(authorize_endpoint, {
    host: base_url,
    query: {
      clientId: client_id,
      codeChallenge: createHash("sha256").update(oidcSession.codeVerifier, "utf8").digest("base64"),
      codeChallengeMethod: PKCEMethod.S256,
      loginHint: loginSession.loginHint.length ? loginSession.loginHint[0] : null,
      nonce: oidcSession.nonce,
      redirectUri: oidcSession.redirectUri,
      responseMode: ResponseMode.QUERY,
      responseType: response_type,
      scope: oidcSession.scope,
      state: oidcSession.state,
    },
  });

  ctx.setCookie(OIDC_SESSION_COOKIE_NAME, oidcSession.id, { expiry: oidcSession.expires });

  loginSession.remember = remember;

  await loginSessionCache.update(loginSession);

  return { redirect: redirectTo };
};
