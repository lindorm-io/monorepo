import { axiosBearerAuthMiddleware } from "@lindorm-io/axios";
import {
  GetAuthenticationTokenQuery,
  GetAuthenticationTokenResponse,
  OpenIdScope,
  TokenRequestBody,
  TokenResponse,
} from "@lindorm-io/common-types";
import { uniqArray } from "@lindorm-io/core";
import { ClientError } from "@lindorm-io/errors";
import { expiryDate } from "@lindorm-io/expiry";
import { difference } from "lodash";
import { AuthenticationTokenSession, ClientSession } from "../../entity";
import { ClientSessionType } from "../../enum";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";
import { generateTokenResponse } from "../oauth";
import { generateServerCredentialsJwt } from "../token";

export const handleAuthenticationTokenGrant = async (
  ctx: ServerKoaContext<TokenRequestBody>,
): Promise<TokenResponse> => {
  const {
    axios: { authenticationClient },
    data: { authenticationToken, scope },
    entity: { client },
    redis: { authenticationTokenSessionCache },
    mongo: { clientSessionRepository },
  } = ctx;

  if (!authenticationToken) {
    throw new ClientError("Missing authentication token");
  }

  const scopes = scope ? scope.split(" ") : [];
  const diff = difference(scopes, client.allowed.scopes);

  if (diff.length) {
    throw new ClientError("Invalid scope", {
      code: "invalid_request",
      description: "Invalid scope",
      debug: {
        expect: client.allowed.scopes,
        actual: scopes,
        diff,
      },
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  const authenticationTokenSession = await authenticationTokenSessionCache.create(
    new AuthenticationTokenSession({
      audiences: uniqArray(
        client.id,
        client.audiences.identity,
        configuration.oauth.client_id,
        configuration.services.authentication_service.client_id,
        configuration.services.identity_service.client_id,
      ),
      clientId: client.id,
      expires: expiryDate(configuration.defaults.expiry.authentication_token_session),
      metadata: {},
      scopes: scopes as Array<OpenIdScope>,
      token: authenticationToken,
    }),
  );

  const query = { session: authenticationTokenSession.id };
  const middleware = [
    axiosBearerAuthMiddleware(
      generateServerCredentialsJwt(ctx, [configuration.services.authentication_service.client_id]),
    ),
  ];

  const { data } = await authenticationClient.get<
    GetAuthenticationTokenResponse,
    never,
    GetAuthenticationTokenQuery
  >(configuration.services.authentication_service.routes.authentication_token, {
    query,
    middleware,
  });

  const clientSession = await clientSessionRepository.create(
    new ClientSession({
      audiences: authenticationTokenSession.audiences,
      clientId: client.id,
      identityId: data.identityId,
      latestAuthentication: new Date(data.latestAuthentication),
      levelOfAssurance: data.levelOfAssurance,
      metadata: authenticationTokenSession.metadata,
      methods: data.methods,
      nonce: data.nonce,
      scopes: authenticationTokenSession.scopes,
      tenantId: client.tenantId,
      type: authenticationTokenSession.scopes.includes(OpenIdScope.OFFLINE_ACCESS)
        ? ClientSessionType.REFRESH
        : ClientSessionType.EPHEMERAL,
    }),
  );

  await authenticationTokenSessionCache.destroy(authenticationTokenSession);

  return generateTokenResponse(ctx, client, clientSession);
};
