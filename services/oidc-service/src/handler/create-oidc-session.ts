import { ClientError } from "@lindorm-io/errors";
import { OidcSession } from "../entity";
import { ServerKoaContext } from "../types";
import { configuration } from "../server/configuration";
import { createPKCE } from "@lindorm-io/node-pkce";
import { createURL } from "@lindorm-io/url";
import { find } from "lodash";
import { randomString } from "@lindorm-io/random";
import { removeEmptyFromObject } from "@lindorm-io/core";
import { OauthResponseModes, OauthResponseTypes } from "@lindorm-io/common-types";

type Options = {
  callbackId: string;
  callbackUri: string;
  expires: Date;
  identityId?: string;
  loginHint?: string;
  provider: string;
};

export const createOidcSession = async (ctx: ServerKoaContext, options: Options): Promise<URL> => {
  const {
    cache: { oidcSessionCache },
  } = ctx;

  const { callbackId, callbackUri, expires, identityId, loginHint, provider } = options;

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

  const {
    challenge: codeChallenge,
    method: codeChallengeMethod,
    verifier: codeVerifier,
  } = createPKCE();

  const oidcSession = await oidcSessionCache.create(
    new OidcSession({
      callbackId,
      callbackUri,
      codeVerifier,
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
      ...(responseType === OauthResponseTypes.CODE
        ? {
            codeChallenge,
            codeChallengeMethod,
          }
        : {}),
      loginHint,
      nonce: oidcSession.nonce,
      redirectUri: createURL("/callback", { host: configuration.server.host }).toString(),
      responseMode: OauthResponseModes.QUERY,
      responseType,
      scope,
      state: oidcSession.state,
    }),
  });
};
