import { Client, AccessSession, RefreshSession } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { LindormScopes } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { createAccessToken, createIdToken, createRefreshToken } from "../token";
import { getIdentityUserinfo } from "../identity";

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

  const { token: accessToken, expiresIn } = createAccessToken(ctx, client, session);
  const { active, ...claims } = await getIdentityUserinfo(ctx, accessToken);

  if (!active) {
    throw new ClientError("Invalid identity", {
      code: "invalid_request",
      description: "Identity is blocked",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  body.accessToken = accessToken;
  body.expiresIn = expiresIn;
  body.tokenType = "Bearer";

  if (session.scopes.includes(LindormScopes.OPENID)) {
    const { token: idToken } = createIdToken(ctx, client, session, claims);

    body.idToken = idToken;
  }

  if (session.scopes.includes(LindormScopes.OFFLINE_ACCESS)) {
    if (!(session instanceof RefreshSession)) {
      throw new ServerError("Unexpected session type");
    }

    const { token: refreshToken } = createRefreshToken(ctx, client, session);

    body.refreshToken = refreshToken;
  }

  body.scope = session.scopes;

  return body;
};
