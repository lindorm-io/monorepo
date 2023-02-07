import { AUTHORIZATION_SESSION_COOKIE_NAME } from "../../constant";
import { AuthorizationSession, BrowserSession, Client, ConsentSession } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaContext } from "../../types";
import { createAccessToken, createIdToken } from "../token";
import { createURL } from "@lindorm-io/url";
import { generateAuthorizationCode } from "./generate-authorization-code";
import { getIdentityUserinfo } from "../identity";
import { LindormScopes, OauthResponseModes, OauthResponseTypes } from "@lindorm-io/common-types";

type Data = {
  accessToken: string;
  code: string;
  expiresIn: number;
  idToken: string;
  redirectData: string;
  state: string;
  tokenType: string;
};

export const generateCallbackResponse = async (
  ctx: ServerKoaContext,
  authSession: AuthorizationSession,
  browserSession: BrowserSession,
  consentSession: ConsentSession,
  client: Client,
): ControllerResponse => {
  let authorizationSession = authSession;

  const { nonce, redirectUri, responseMode, responseTypes, state } = authorizationSession;
  const { audiences, scopes } = consentSession;

  const { token: accessToken, expiresIn } = createAccessToken(ctx, client, browserSession, {
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

  const data: Partial<Data> = {};

  if (responseTypes.includes(OauthResponseTypes.CODE)) {
    const authorizationCode = await generateAuthorizationCode(ctx, authorizationSession);
    data.code = authorizationCode.code;
  }

  if (responseTypes.includes(OauthResponseTypes.TOKEN)) {
    data.accessToken = accessToken;
    data.expiresIn = expiresIn;
    data.tokenType = "Bearer";
  }

  if (
    responseTypes.includes(OauthResponseTypes.ID_TOKEN) &&
    scopes.includes(LindormScopes.OPENID)
  ) {
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
    case OauthResponseModes.FORM_POST:
      return { redirect: redirectUri, body: data };

    case OauthResponseModes.FRAGMENT:
      return {
        redirect: createURL(redirectUri, { query: data, queryCaseTransform: "snake" })
          .toString()
          .replace("?", "#"),
      };

    case OauthResponseModes.QUERY:
      return {
        redirect: createURL(redirectUri, { query: data, queryCaseTransform: "snake" }).toString(),
      };

    default:
      throw new ServerError("Unexpected Response Mode");
  }
};
