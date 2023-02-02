import { AuthorizationSession, BrowserSession, Client, ConsentSession } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ResponseMode, ResponseType, Scope } from "../../common";
import { ServerKoaContext } from "../../types";
import { createAccessToken, createIdToken } from "../token";
import { createURL } from "@lindorm-io/url";
import { getIdentityUserinfo } from "../identity";
import { generateAuthorizationCode } from "./generate-authorization-code";
import { AUTHORIZATION_SESSION_COOKIE_NAME } from "../../constant";

interface Data {
  accessToken: string;
  code: string;
  expiresIn: number;
  idToken: string;
  redirectData: string;
  state: string;
  tokenType: string;
}

export const generateCallbackResponse = async (
  ctx: ServerKoaContext,
  authSession: AuthorizationSession,
  browserSession: BrowserSession,
  consentSession: ConsentSession,
  client: Client,
): ControllerResponse => {
  let authorizationSession = authSession;

  const { nonce, redirectUri, responseMode, responseTypes, state } = authorizationSession;
  const { identityId } = browserSession;
  const { audiences, scopes } = consentSession;

  const { active, claims, permissions } = await getIdentityUserinfo(ctx, identityId, scopes);

  if (!active) {
    throw new ClientError("Invalid identity", {
      code: "invalid_request",
      description: "Identity is blocked",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  const data: Partial<Data> = {};

  if (responseTypes.includes(ResponseType.CODE)) {
    const authorizationCode = await generateAuthorizationCode(ctx, authorizationSession);
    data.code = authorizationCode.code;
  }

  if (responseTypes.includes(ResponseType.TOKEN)) {
    const { token: accessToken, expiresIn } = createAccessToken(ctx, client, browserSession, {
      audiences,
      permissions,
      scopes,
    });

    data.accessToken = accessToken;
    data.expiresIn = expiresIn;
    data.tokenType = "Bearer";
  }

  if (responseTypes.includes(ResponseType.ID_TOKEN) && scopes.includes(Scope.OPENID)) {
    const { token: idToken } = createIdToken(ctx, client, browserSession, {
      audiences,
      claims,
      nonce,
      scopes,
    });

    data.idToken = idToken;
  }

  data.state = state;

  if (authorizationSession.redirectData) {
    data.redirectData = authorizationSession.redirectData;
  }

  ctx.cookies.set(AUTHORIZATION_SESSION_COOKIE_NAME);

  switch (responseMode) {
    case ResponseMode.FORM_POST:
      return { redirect: redirectUri, body: data };

    case ResponseMode.FRAGMENT:
      return {
        redirect: createURL(redirectUri, { query: data, queryCaseTransform: "snake" })
          .toString()
          .replace("?", "#"),
      };

    case ResponseMode.QUERY:
      return {
        redirect: createURL(redirectUri, { query: data, queryCaseTransform: "snake" }).toString(),
      };

    default:
      throw new ServerError("Unexpected Response Mode");
  }
};
