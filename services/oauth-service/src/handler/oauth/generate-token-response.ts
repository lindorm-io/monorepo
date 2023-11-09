import { Scope } from "@lindorm-io/common-enums";
import { OpenIdTokenResponseBody } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { expiresIn } from "@lindorm-io/expiry";
import { createOpaqueToken } from "@lindorm-io/jwt";
import { Client, ClientSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { getIdentityClaims } from "../identity";
import { createIdToken, generateAccessToken, generateRefreshToken } from "../token";

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

  const accessOpaque = createOpaqueToken();
  const accessToken = await generateAccessToken(ctx, client, clientSession, accessOpaque);

  body.accessToken = accessOpaque.token;
  body.expiresIn = expiresIn(accessToken.expires);
  body.tokenType = "Bearer";

  if (clientSession.scopes.includes(Scope.OPENID)) {
    const { token: idToken } = createIdToken(ctx, client, clientSession, claims, body.accessToken);

    body.idToken = idToken;
  }

  if (clientSession.scopes.includes(Scope.OFFLINE_ACCESS)) {
    const refreshOpaque = createOpaqueToken({ length: 192 });
    await generateRefreshToken(ctx, client, clientSession, refreshOpaque);

    body.refreshToken = refreshOpaque.token;
  }

  if (clientSession.scopes.length) {
    body.scope = clientSession.scopes.join(" ");
  }

  return body;
};
