import { TransformMode } from "@lindorm-io/axios";
import { OpenIdResponseMode, OpenIdResponseType } from "@lindorm-io/common-enums";
import { removeEmptyFromObject } from "@lindorm-io/core";
import { ClientError } from "@lindorm-io/errors";
import { createPKCE } from "@lindorm-io/node-pkce";
import { randomHex } from "@lindorm-io/random";
import { createURL } from "@lindorm-io/url";
import { find } from "lodash";
import { FederationSession } from "../entity";
import { configuration } from "../server/configuration";
import { ServerKoaContext } from "../types";

type Options = {
  callbackId: string;
  callbackUri: string;
  expires: Date;
  identityId?: string;
  loginHint?: string;
  provider: string;
};

export const createFederationSession = async (
  ctx: ServerKoaContext,
  options: Options,
): Promise<URL> => {
  const {
    redis: { federationSessionCache },
  } = ctx;

  const { callbackId, callbackUri, expires, identityId, loginHint, provider } = options;

  const config = find(configuration.federation_providers, { key: provider });

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

  const federationSession = await federationSessionCache.create(
    new FederationSession({
      callbackId,
      callbackUri,
      codeVerifier,
      expires,
      identityId,
      nonce: randomHex(16),
      provider,
      state: randomHex(48),
    }),
  );

  return createURL(endpoint, {
    host,
    query: removeEmptyFromObject({
      clientId,
      ...(responseType === OpenIdResponseType.CODE
        ? {
            codeChallenge,
            codeChallengeMethod,
          }
        : {}),
      loginHint,
      nonce: federationSession.nonce,
      redirectUri: createURL("/callback", { host: configuration.server.host }).toString(),
      responseMode: OpenIdResponseMode.QUERY,
      responseType,
      scope,
      state: federationSession.state,
    }),
    queryCaseTransform: TransformMode.SNAKE,
  });
};
