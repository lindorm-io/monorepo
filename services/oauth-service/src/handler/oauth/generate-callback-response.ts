import { AuthorizationSession, BrowserSession, Client } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { Context } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { ResponseMode, ResponseType, Scope } from "../../common";
import { createAccessToken, createIdToken } from "../token";
import { createURL } from "@lindorm-io/core";
import { getIdentityUserinfo } from "../identity";
import { includes } from "lodash";
import { setAuthorizationCode } from "./set-authorization-code";

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
  ctx: Context,
  authSession: AuthorizationSession,
  browserSession: BrowserSession,
  client: Client,
): ControllerResponse => {
  let authorizationSession = authSession;

  const { identityId } = browserSession;
  const { nonce, redirectUri, responseMode, responseTypes, scopes, state } = authorizationSession;

  const { active, claims, permissions } = await getIdentityUserinfo(ctx, identityId, scopes);

  if (!active) {
    throw new ClientError("Invalid identity", {
      code: "invalid_request",
      description: "Identity is blocked",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  const data: Partial<Data> = {};

  if (!authorizationSession.code) {
    authorizationSession = await setAuthorizationCode(ctx, authorizationSession);
  }

  if (includes(responseTypes, ResponseType.CODE)) {
    data.code = authorizationSession.code;
  }

  if (includes(responseTypes, ResponseType.TOKEN)) {
    const { token: accessToken, expiresIn } = createAccessToken(ctx, client, browserSession, {
      permissions,
      scopes,
    });

    data.accessToken = accessToken;
    data.expiresIn = expiresIn;
    data.tokenType = "Bearer";
  }

  if (includes(responseTypes, ResponseType.ID_TOKEN) && includes(scopes, Scope.OPENID)) {
    const { token: idToken } = createIdToken(ctx, client, browserSession, {
      claims,
      scopes,
      nonce,
    });

    data.idToken = idToken;
  }

  data.state = state;

  if (authorizationSession.redirectData) {
    data.redirectData = authorizationSession.redirectData;
  }

  switch (responseMode) {
    case ResponseMode.FORM_POST:
      return { redirect: redirectUri, body: data };

    case ResponseMode.FRAGMENT:
      return {
        redirect: createURL(redirectUri, { query: data }).toString().replace("?", "#"),
      };

    case ResponseMode.QUERY:
      return {
        redirect: createURL(redirectUri, { query: data }).toString(),
      };

    default:
      throw new ServerError("Unexpected Response Mode");
  }
};
