import { OpenIdScope, OpenIdTokenResponseBody } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { expiresIn } from "@lindorm-io/expiry";
import { Client, ClientSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { getIdentityClaims } from "../identity";
import {
  convertOpaqueTokenToJwt,
  createIdToken,
  generateAccessToken,
  generateRefreshToken,
} from "../token";

export const generateTokenResponse = async (
  ctx: ServerKoaContext,
  client: Client,
  clientSession: ClientSession,
): Promise<Partial<OpenIdTokenResponseBody>> => {
  const body: Partial<OpenIdTokenResponseBody> = {};

  const { active, ...claims } = await getIdentityClaims(ctx, client, clientSession);

  if (!active) {
    throw new ClientError("Invalid identity", {
      code: "invalid_request",
      description: "Identity is blocked",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  const accessToken = await generateAccessToken(ctx, client, clientSession);
  const accessJwt = client.opaqueAccessToken
    ? undefined
    : convertOpaqueTokenToJwt(ctx, clientSession, accessToken);

  body.accessToken = accessJwt?.token || accessToken.token;
  body.expiresIn = expiresIn(accessToken.expires);
  body.tokenType = "Bearer";

  if (clientSession.scopes.includes(OpenIdScope.OPENID)) {
    const { token: idToken } = createIdToken(ctx, client, clientSession, claims);

    body.idToken = idToken;
  }

  if (clientSession.scopes.includes(OpenIdScope.OFFLINE_ACCESS)) {
    const refreshToken = await generateRefreshToken(ctx, client, clientSession);

    body.refreshToken = refreshToken.token;
  }

  if (clientSession.scopes.length) {
    body.scope = clientSession.scopes.join(" ");
  }

  return body;
};
