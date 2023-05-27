import { OpenIdGrantType, TokenRequestBody, TokenResponse } from "@lindorm-io/common-types";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { JOI_CODE, JOI_GRANT_TYPE } from "../../constant";
import {
  handleAuthenticationTokenGrant,
  handleAuthorizationCodeGrant,
  handleClientCredentialsGrant,
  handleJwtBearerGrant,
  handlePasswordGrant,
  handleRefreshTokenGrant,
} from "../../handler";
import { ServerKoaController } from "../../types";

type RequestData = TokenRequestBody;

type ResponseBody = TokenResponse;

export const oauthTokenSchema = Joi.object<RequestData>()
  .keys({
    assertion: Joi.string(),
    authenticationToken: Joi.string(),
    clientId: Joi.string().guid(),
    clientSecret: Joi.string(),
    code: JOI_CODE,
    codeVerifier: Joi.string(),
    grantType: JOI_GRANT_TYPE.required(),
    redirectUri: Joi.string().uri(),
    refreshToken: Joi.string().min(128),
    scope: Joi.string(),
  })
  .options({ abortEarly: false, allowUnknown: true })
  .required();

export const oauthTokenController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<Partial<ResponseBody>> => {
  const {
    data: { grantType },
    entity: { client },
  } = ctx;

  if (!client.allowed.grantTypes.includes(grantType as OpenIdGrantType)) {
    throw new ClientError("Invalid Grant Type", {
      code: "invalid_request",
      debug: {
        expect: client.allowed.grantTypes,
        actual: grantType,
      },
      description: "Invalid grant type",
    });
  }

  let body: Partial<ResponseBody> = {};

  ctx.set("Cache-Control", "no-store");
  ctx.set("Pragma", "no-cache");

  switch (grantType) {
    case OpenIdGrantType.AUTHENTICATION_TOKEN:
      body = await handleAuthenticationTokenGrant(ctx);
      break;

    case OpenIdGrantType.AUTHORIZATION_CODE:
      body = await handleAuthorizationCodeGrant(ctx);
      break;

    case OpenIdGrantType.JWT_BEARER:
      body = await handleJwtBearerGrant(ctx);
      break;

    case OpenIdGrantType.CLIENT_CREDENTIALS:
      body = await handleClientCredentialsGrant(ctx);
      break;

    case OpenIdGrantType.PASSWORD:
      body = await handlePasswordGrant(ctx);
      break;

    case OpenIdGrantType.REFRESH_TOKEN:
      body = await handleRefreshTokenGrant(ctx);
      break;

    default:
      throw new ServerError("Unexpected Grant Type", {
        data: { grantType },
      });
  }

  return { body };
};
