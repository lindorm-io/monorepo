import { axiosBearerAuthMiddleware } from "@lindorm-io/axios";
import {
  OpenIdScope,
  TokenRequestBody,
  TokenResponse,
  VerifyPasswordRequestBody,
  VerifyPasswordResponse,
} from "@lindorm-io/common-types";
import { uniqArray } from "@lindorm-io/core";
import { ClientError } from "@lindorm-io/errors";
import { difference } from "lodash";
import { ClientSession } from "../../entity";
import { ClientSessionType } from "../../enum";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";
import { generateTokenResponse } from "../oauth";
import { generateServerCredentialsJwt } from "../token";

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

  const scopes = (scope ? scope.split(" ") : []) as Array<OpenIdScope>;
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
    axiosBearerAuthMiddleware(
      generateServerCredentialsJwt(ctx, [configuration.services.authentication_service.client_id]),
    ),
  ];

  const { data } = await authenticationClient.post<
    VerifyPasswordResponse,
    VerifyPasswordRequestBody
  >(configuration.services.authentication_service.routes.password, {
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
      clientId: client.id,
      identityId: data.identityId,
      latestAuthentication: new Date(data.latestAuthentication),
      levelOfAssurance: data.levelOfAssurance,
      metadata: {},
      methods: data.methods,
      nonce: data.nonce,
      scopes,
      tenantId: client.tenantId,
      type: scopes.includes(OpenIdScope.OFFLINE_ACCESS)
        ? ClientSessionType.REFRESH
        : ClientSessionType.EPHEMERAL,
    }),
  );

  return await generateTokenResponse(ctx, client, clientSession);
};
