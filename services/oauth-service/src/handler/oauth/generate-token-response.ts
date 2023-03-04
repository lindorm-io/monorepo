import { Client, ClientSession } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { OpenIdScope } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { expiresIn } from "@lindorm-io/expiry";
import { getIdentityClaims } from "../identity";
import {
  convertOpaqueTokenToJwt,
  createIdToken,
  generateAccessToken,
  generateRefreshToken,
} from "../token";

type ResponseBody = {
  accessToken: string;
  expiresIn: number;
  idToken: string;
  refreshToken: string;
  scope: Array<string>;
  tokenType: string;
};

export const generateTokenResponse = async (
  ctx: ServerKoaContext,
  client: Client,
  clientSession: ClientSession,
): Promise<Partial<ResponseBody>> => {
  const body: Partial<ResponseBody> = {};

  const { active, ...claims } = await getIdentityClaims(ctx, client, clientSession);

  if (!active) {
    throw new ClientError("Invalid identity", {
      code: "invalid_request",
      description: "Identity is blocked",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  const accessToken = await generateAccessToken(ctx, client, clientSession);
  const accessJwt = client.opaque
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
    const refreshJwt = client.opaque
      ? undefined
      : convertOpaqueTokenToJwt(ctx, clientSession, refreshToken);

    body.refreshToken = refreshJwt?.token || refreshToken.token;
  }

  body.scope = clientSession.scopes;

  return body;
};
