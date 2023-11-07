import {
  AuthenticationMethod,
  OpenIdGrantType,
  OpenIdScope,
  TokenRequestBody,
  TokenResponse,
} from "@lindorm-io/common-types";
import { uniqArray } from "@lindorm-io/core";
import { ClientError } from "@lindorm-io/errors";
import { randomHex } from "@lindorm-io/random";
import { difference } from "lodash";
import { ClientSession } from "../../entity";
import { ClientSessionType } from "../../enum";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";
import { generateTokenResponse } from "../oauth";
import { verifyAssertionId } from "../redis";

export const handleJwtBearerGrant = async (
  ctx: ServerKoaContext<TokenRequestBody>,
): Promise<TokenResponse> => {
  const {
    data: { assertion, scope },
    entity: { client },
    jwt,
    mongo: { clientSessionRepository },
  } = ctx;

  if (!assertion) {
    throw new ClientError("Missing assertion");
  }

  const split = scope ? scope.split(" ") : [];
  const scopes = split.filter((s: any) => ![OpenIdScope.OFFLINE_ACCESS].includes(s));
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

  const verified = jwt.verify(assertion, {
    algorithms: client.authorizationAssertion.algorithm
      ? [client.authorizationAssertion.algorithm]
      : ["HS256"],
    audience: configuration.oauth.client_id,
    clockTolerance: 10,
    issuer: client.authorizationAssertion.issuer ? client.authorizationAssertion.issuer : client.id,
    maxAge: 60,
    secret: client.authorizationAssertion.secret
      ? client.authorizationAssertion.secret
      : client.secret,
  });

  await verifyAssertionId(ctx, verified.id);

  const methods = verified.metadata.authMethodsReference.filter((x: any) =>
    Object.values(AuthenticationMethod).includes(x),
  ) as Array<AuthenticationMethod>;

  const clientSession = await clientSessionRepository.create(
    new ClientSession({
      audiences: uniqArray(
        client.id,
        client.audiences.identity,
        configuration.oauth.client_id,
        configuration.services.authentication_service.client_id,
        configuration.services.identity_service.client_id,
      ),
      authorizationGrant: OpenIdGrantType.JWT_BEARER,
      clientId: client.id,
      expires: new Date(verified.metadata.expires * 1000),
      factors: [],
      identityId: verified.subject,
      latestAuthentication: new Date(),
      levelOfAssurance: 1,
      metadata: {},
      methods,
      nonce: randomHex(16),
      scopes,
      strategies: [],
      tenantId: client.tenantId,
      type: ClientSessionType.EPHEMERAL,
    }),
  );

  return await generateTokenResponse(ctx, client, clientSession);
};
