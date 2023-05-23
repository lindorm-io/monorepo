import { OpenIdResponseMode, OpenIdResponseType, OpenIdScope } from "@lindorm-io/common-types";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { expiresIn } from "@lindorm-io/expiry";
import { createOpaqueToken } from "@lindorm-io/jwt";
import { ControllerResponse } from "@lindorm-io/koa";
import { createURL } from "@lindorm-io/url";
import { AUTHORIZATION_SESSION_COOKIE_NAME } from "../../constant";
import { AuthorizationRequest, Client, ClientSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { getIdentityClaims } from "../identity";
import { convertOpaqueTokenToJwt, createIdToken, generateAccessToken } from "../token";
import { generateAuthorizationCode } from "./generate-authorization-code";

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
  authorizationRequest: AuthorizationRequest,
  client: Client,
  clientSession: ClientSession,
): ControllerResponse => {
  const data: Partial<CallbackData> = {};

  const { active, ...claims } = await getIdentityClaims(ctx, clientSession);

  if (!active) {
    throw new ClientError("Invalid identity", {
      code: "invalid_request",
      description: "Identity is blocked",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  if (authorizationRequest.responseTypes.includes(OpenIdResponseType.CODE)) {
    data.code = await generateAuthorizationCode(ctx, authorizationRequest);
  }

  if (authorizationRequest.responseTypes.includes(OpenIdResponseType.TOKEN)) {
    const accessOpaque = createOpaqueToken();
    const accessToken = await generateAccessToken(ctx, client, clientSession, accessOpaque);
    const accessJwt = client.opaqueAccessToken
      ? undefined
      : convertOpaqueTokenToJwt(ctx, clientSession, accessToken);

    data.accessToken = accessJwt?.token || accessOpaque.token;
    data.expiresIn = expiresIn(accessToken.expires);
    data.tokenType = "Bearer";
  }

  if (
    authorizationRequest.responseTypes.includes(OpenIdResponseType.ID_TOKEN) &&
    clientSession.scopes.includes(OpenIdScope.OPENID)
  ) {
    const { token: idToken } = createIdToken(ctx, client, clientSession, claims);

    data.idToken = idToken;
  }

  data.state = authorizationRequest.state;

  if (authorizationRequest.redirectData) {
    data.redirectData = authorizationRequest.redirectData;
  }

  ctx.cookies.set(AUTHORIZATION_SESSION_COOKIE_NAME);

  switch (authorizationRequest.responseMode) {
    case OpenIdResponseMode.FORM_POST:
      return {
        redirect: authorizationRequest.redirectUri,
        body: data,
      };

    case OpenIdResponseMode.FRAGMENT:
      return {
        redirect: createURL(authorizationRequest.redirectUri, {
          query: data,
          queryCaseTransform: "snake",
        })
          .toString()
          .replace("?", "#"),
      };

    case OpenIdResponseMode.QUERY:
      return {
        redirect: createURL(authorizationRequest.redirectUri, {
          query: data,
          queryCaseTransform: "snake",
        }).toString(),
      };

    default:
      throw new ServerError("Unexpected Response Mode");
  }
};
