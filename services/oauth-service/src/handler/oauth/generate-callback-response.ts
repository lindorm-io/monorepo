import { TransformMode } from "@lindorm-io/case";
import { OpenIdResponseMode, OpenIdResponseType, Scope } from "@lindorm-io/common-enums";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { expiresIn } from "@lindorm-io/expiry";
import { createOpaqueToken } from "@lindorm-io/jwt";
import { ControllerResponse } from "@lindorm-io/koa";
import { createURL } from "@lindorm-io/url";
import { AUTHORIZATION_SESSION_COOKIE_NAME } from "../../constant";
import { AuthorizationSession, Client, ClientSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { getIdentityClaims } from "../identity";
import { createIdToken, encryptIdToken, generateAccessToken } from "../token";
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
    const accessOpaque = createOpaqueToken({ roles: claims.roles });
    const accessToken = await generateAccessToken(ctx, client, clientSession, accessOpaque);

    data.accessToken = accessOpaque.token;
    data.expiresIn = expiresIn(accessToken.expires);
    data.tokenType = "Bearer";
  }

  if (
    authorizationSession.responseTypes.includes(OpenIdResponseType.ID_TOKEN) &&
    clientSession.scopes.includes(Scope.OPENID)
  ) {
    let { token: idToken } = createIdToken(ctx, client, clientSession, claims, data.accessToken);

    if (client.idTokenEncryption.algorithm) {
      idToken = await encryptIdToken(ctx, client, idToken);
    }

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
          queryCaseTransform: TransformMode.SNAKE,
        })
          .toString()
          .replace("?", "#"),
      };

    case OpenIdResponseMode.QUERY:
      return {
        redirect: createURL(authorizationSession.redirectUri, {
          query: data,
          queryCaseTransform: TransformMode.SNAKE,
        }).toString(),
      };

    default:
      throw new ServerError("Unexpected Response Mode");
  }
};
