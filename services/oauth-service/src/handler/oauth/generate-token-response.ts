import { Client, BrowserSession, RefreshSession, ConsentSession } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { createAccessToken, createIdToken, createRefreshToken } from "../token";
import { getIdentityUserinfo } from "../identity";
import { LindormScopes } from "@lindorm-io/common-types";

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
  session: BrowserSession | RefreshSession,
  consentSession: ConsentSession,
): Promise<Partial<ResponseBody>> => {
  const body: Partial<ResponseBody> = {};

  const { nonce } = session;
  const { audiences, scopes } = consentSession;

  const { token: accessToken, expiresIn } = createAccessToken(ctx, client, session, {
    audiences,
    scopes,
  });

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

  if (scopes.includes(LindormScopes.OPENID)) {
    const { token: idToken } = createIdToken(ctx, client, session, {
      audiences,
      claims,
      scopes,
      nonce,
    });

    body.idToken = idToken;
  }

  if (scopes.includes(LindormScopes.OFFLINE_ACCESS)) {
    if (!(session instanceof RefreshSession)) {
      throw new ServerError("Unexpected session type");
    }

    const { token: refreshToken } = createRefreshToken(ctx, client, session);

    body.refreshToken = refreshToken;
  }

  body.scope = scopes;

  return body;
};
