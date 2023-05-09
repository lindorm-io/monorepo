import {
  OpenIdGrantType,
  OpenIdTokenRequestBody,
  OpenIdTokenResponseBody,
} from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { JOI_CODE, JOI_GRANT_TYPE } from "../../constant";
import {
  handleAuthorizationCodeGrant,
  handleClientCredentialsGrant,
  handleRefreshTokenGrant,
} from "../../handler";
import { ServerKoaController } from "../../types";

type RequestData = OpenIdTokenRequestBody;

type ResponseBody = OpenIdTokenResponseBody;

export const oauthTokenSchema = Joi.object<RequestData>()
  .keys({
    clientId: Joi.string().guid(),
    clientSecret: Joi.string(),
    code: JOI_CODE,
    codeVerifier: Joi.string(),
    grantType: JOI_GRANT_TYPE.required(),
    redirectUri: Joi.string().uri(),
    refreshToken: Joi.string().min(128),
    scope: Joi.string(),
  })
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

  switch (grantType) {
    case OpenIdGrantType.AUTHORIZATION_CODE:
      body = await handleAuthorizationCodeGrant(ctx);
      break;

    case OpenIdGrantType.CLIENT_CREDENTIALS:
      body = await handleClientCredentialsGrant(ctx);
      break;

    case OpenIdGrantType.REFRESH_TOKEN:
      body = await handleRefreshTokenGrant(ctx);
      break;

    default:
      break;
  }

  return { body };
};
