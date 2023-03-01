import { AccessSession, Client, RefreshSession } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { OpenIdScope } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { createAccessToken, createIdToken, createRefreshToken } from "../token";
import { getIdentityClaims } from "../identity";

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
  session: AccessSession | RefreshSession,
): Promise<Partial<ResponseBody>> => {
  const body: Partial<ResponseBody> = {};

  const { active, ...claims } = await getIdentityClaims(ctx, client, session);

  if (!active) {
    throw new ClientError("Invalid identity", {
      code: "invalid_request",
      description: "Identity is blocked",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  const { token: accessToken, expiresIn } = createAccessToken(ctx, client, session);

  body.accessToken = accessToken;
  body.expiresIn = expiresIn;
  body.tokenType = "Bearer";

  if (session.scopes.includes(OpenIdScope.OPENID)) {
    const { token: idToken } = createIdToken(ctx, client, session, claims);

    body.idToken = idToken;
  }

  if (session.scopes.includes(OpenIdScope.OFFLINE_ACCESS)) {
    if (!(session instanceof RefreshSession)) {
      throw new ServerError("Unexpected session type");
    }

    const { token: refreshToken } = createRefreshToken(ctx, client, session);

    body.refreshToken = refreshToken;
  }

  body.scope = session.scopes;

  return body;
};
