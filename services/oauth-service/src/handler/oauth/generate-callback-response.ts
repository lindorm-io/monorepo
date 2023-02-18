import { AUTHORIZATION_SESSION_COOKIE_NAME } from "../../constant";
import { AccessSession, AuthorizationSession, Client, RefreshSession } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { LindormScopes, OauthResponseModes, OauthResponseTypes } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { createAccessToken, createIdToken } from "../token";
import { createURL } from "@lindorm-io/url";
import { generateAuthorizationCode } from "./generate-authorization-code";
import { getIdentityUserinfo } from "../identity";

type CallbackData = {
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
  authorizationSession: AuthorizationSession,
  client: Client,
  session: AccessSession | RefreshSession,
): ControllerResponse => {
  const { redirectUri, responseMode, responseTypes, state } = authorizationSession;

  const { token: accessToken, expiresIn } = createAccessToken(ctx, client, session);
  const { active, ...claims } = await getIdentityUserinfo(ctx, accessToken);

  if (!active) {
    throw new ClientError("Invalid identity", {
      code: "invalid_request",
      description: "Identity is blocked",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  const data: Partial<CallbackData> = {};

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
    session.scopes.includes(LindormScopes.OPENID)
  ) {
    const { token: idToken } = createIdToken(ctx, client, session, claims);

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
