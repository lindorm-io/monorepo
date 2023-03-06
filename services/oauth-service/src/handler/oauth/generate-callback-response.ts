import { AUTHORIZATION_SESSION_COOKIE_NAME } from "../../constant";
import { AuthorizationSession, Client, ClientSession } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { OpenIdResponseMode, OpenIdResponseType, OpenIdScope } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { convertOpaqueTokenToJwt, createIdToken, generateAccessToken } from "../token";
import { createURL } from "@lindorm-io/url";
import { expiresIn } from "@lindorm-io/expiry";
import { generateAuthorizationCode } from "./generate-authorization-code";
import { getIdentityClaims } from "../identity";

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
  clientSession: ClientSession,
): ControllerResponse => {
  const data: Partial<CallbackData> = {};

  const { active, ...claims } = await getIdentityClaims(ctx, client, clientSession);

  if (!active) {
    throw new ClientError("Invalid identity", {
      code: "invalid_request",
      description: "Identity is blocked",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  if (authorizationSession.responseTypes.includes(OpenIdResponseType.CODE)) {
    data.code = await generateAuthorizationCode(ctx, authorizationSession);
  }

  if (authorizationSession.responseTypes.includes(OpenIdResponseType.TOKEN)) {
    const accessToken = await generateAccessToken(ctx, client, clientSession);
    const accessJwt = client.opaque
      ? undefined
      : convertOpaqueTokenToJwt(ctx, clientSession, accessToken);

    data.accessToken = accessJwt?.token || accessToken.token;
    data.expiresIn = expiresIn(accessToken.expires);
    data.tokenType = "Bearer";
  }

  if (
    authorizationSession.responseTypes.includes(OpenIdResponseType.ID_TOKEN) &&
    clientSession.scopes.includes(OpenIdScope.OPENID)
  ) {
    const { token: idToken } = createIdToken(ctx, client, clientSession, claims);

    data.idToken = idToken;
  }

  data.state = authorizationSession.state;

  if (authorizationSession.redirectData) {
    data.redirectData = authorizationSession.redirectData;
  }

  ctx.cookies.set(AUTHORIZATION_SESSION_COOKIE_NAME);

  switch (authorizationSession.responseMode) {
    case OpenIdResponseMode.FORM_POST:
      return {
        redirect: authorizationSession.redirectUri,
        body: data,
      };

    case OpenIdResponseMode.FRAGMENT:
      return {
        redirect: createURL(authorizationSession.redirectUri, {
          query: data,
          queryCaseTransform: "snake",
        })
          .toString()
          .replace("?", "#"),
      };

    case OpenIdResponseMode.QUERY:
      return {
        redirect: createURL(authorizationSession.redirectUri, {
          query: data,
          queryCaseTransform: "snake",
        }).toString(),
      };

    default:
      throw new ServerError("Unexpected Response Mode");
  }
};
