import { Client, BrowserSession, RefreshSession, ConsentSession } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { Scope } from "../../common";
import { ServerKoaContext } from "../../types";
import { createAccessToken, createIdToken, createRefreshToken } from "../token";
import { getIdentityUserinfo } from "../identity";

interface ResponseBody {
  accessToken: string;
  expiresIn: number;
  idToken: string;
  refreshToken: string;
  scope: Array<string>;
  tokenType: string;
}

export const generateTokenResponse = async (
  ctx: ServerKoaContext,
  client: Client,
  session: BrowserSession | RefreshSession,
  consentSession: ConsentSession,
): Promise<Partial<ResponseBody>> => {
  const body: Partial<ResponseBody> = {};

  const { identityId, nonce } = session;
  const { audiences, scopes } = consentSession;

  const { active, claims, permissions } = await getIdentityUserinfo(ctx, identityId, scopes);

  if (!active) {
    throw new ClientError("Invalid identity", {
      code: "invalid_request",
      description: "Identity is blocked",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  const { token: accessToken, expiresIn } = createAccessToken(ctx, client, session, {
    audiences,
    permissions,
    scopes,
  });

  body.accessToken = accessToken;
  body.expiresIn = expiresIn;
  body.tokenType = "Bearer";

  if (scopes.includes(Scope.OPENID)) {
    const { token: idToken } = createIdToken(ctx, client, session, {
      audiences,
      claims,
      scopes,
      nonce,
    });

    body.idToken = idToken;
  }

  if (scopes.includes(Scope.OFFLINE_ACCESS)) {
    if (!(session instanceof RefreshSession)) {
      throw new ServerError("Unexpected session type");
    }

    const { token: refreshToken } = createRefreshToken(ctx, client, session);

    body.refreshToken = refreshToken;
  }

  body.scope = scopes;

  return body;
};
