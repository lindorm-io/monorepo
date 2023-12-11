import { OpenIdGrantType, Scope } from "@lindorm-io/common-enums";
import {
  TokenRequestBody,
  TokenResponse,
  VerifyPasswordRequestBody,
  VerifyPasswordResponse,
} from "@lindorm-io/common-types";
import { uniqArray } from "@lindorm-io/core";
import { ClientError } from "@lindorm-io/errors";
import { expiryDate } from "@lindorm-io/expiry";
import { difference } from "lodash";
import { ClientSession } from "../../entity";
import { ClientSessionType } from "../../enum";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";
import { generateTokenResponse } from "../oauth";
import { generateServerBearerAuthMiddleware } from "../token";

export const handlePasswordGrant = async (
  ctx: ServerKoaContext<TokenRequestBody>,
): Promise<TokenResponse> => {
  const {
    axios: { authenticationClient },
    data: { username, password, scope },
    entity: { client },
    mongo: { clientSessionRepository },
  } = ctx;

  if (!username || !password) {
    throw new ClientError("Missing username or password");
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

  const middleware = [
    generateServerBearerAuthMiddleware(ctx, [
      configuration.services.authentication_service.client_id,
    ]),
  ];

  const { data } = await authenticationClient.post<
    VerifyPasswordResponse,
    VerifyPasswordRequestBody
  >(configuration.services.authentication_service.routes.admin.password, {
    middleware,
  });

  const clientSession = await clientSessionRepository.create(
    new ClientSession({
      audiences: uniqArray(
        client.id,
        client.audiences.identity,
        configuration.oauth.client_id,
        configuration.services.authentication_service.client_id,
        configuration.services.identity_service.client_id,
      ),
      authorizationGrant: OpenIdGrantType.PASSWORD,
      clientId: client.id,
      expires: expiryDate("4 years"),
      factors: data.factors,
      identityId: data.identityId,
      latestAuthentication: new Date(data.latestAuthentication),
      levelOfAssurance: data.levelOfAssurance,
      metadata: {},
      methods: data.methods,
      nonce: data.nonce,
      scopes,
      strategies: data.strategies,
      tenantId: client.tenantId,
      type: scopes.includes(Scope.OFFLINE_ACCESS)
        ? ClientSessionType.REFRESH
        : ClientSessionType.EPHEMERAL,
    }),
  );

  return await generateTokenResponse(ctx, client, clientSession);
};
