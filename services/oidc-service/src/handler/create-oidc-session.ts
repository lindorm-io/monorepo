import { ClientError } from "@lindorm-io/errors";
import { OidcSession } from "../entity";
import { PKCEMethod, createURL, randomString, removeEmptyFromObject } from "@lindorm-io/core";
import { ResponseMode, ResponseType } from "../common";
import { ServerKoaContext } from "../types";
import { configuration } from "../server/configuration";
import { createHash } from "crypto";
import { find } from "lodash";

interface Options {
  callbackUri: string;
  expires: Date;
  identityId?: string;
  loginHint?: string;
  provider: string;
}

export const createOidcSession = async (ctx: ServerKoaContext, options: Options): Promise<URL> => {
  const {
    cache: { oidcSessionCache },
  } = ctx;

  const { callbackUri, expires, identityId, loginHint, provider } = options;

  const config = find(configuration.oidc_providers, { key: provider });

  if (!config) {
    throw new ClientError("Invalid identity provider");
  }

  const {
    authorize_endpoint: endpoint,
    base_url: host,
    client_id: clientId,
    response_type: responseType,
    scope,
  } = config;

  const oidcSession = await oidcSessionCache.create(
    new OidcSession({
      callbackUri,
      codeVerifier: randomString(32),
      expires,
      identityId,
      nonce: randomString(16),
      provider,
      state: randomString(48),
    }),
  );

  return createURL(endpoint, {
    host,
    query: removeEmptyFromObject({
      clientId,
      ...(responseType === ResponseType.CODE
        ? {
            codeChallenge: createHash("sha256")
              .update(oidcSession.codeVerifier, "utf8")
              .digest("base64"),
            codeChallengeMethod: PKCEMethod.S256,
          }
        : {}),
      loginHint,
      nonce: oidcSession.nonce,
      redirectUri: createURL("/callback", { host: configuration.server.host }).toString(),
      responseMode: ResponseMode.QUERY,
      responseType,
      scope,
      state: oidcSession.state,
    }),
  });
};
