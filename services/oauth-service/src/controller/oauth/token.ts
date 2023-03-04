import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_CODE, JOI_GRANT_TYPE } from "../../constant";
import { OpenIdGrantType, TokenRequestBody, TokenResponse } from "@lindorm-io/common-types";
import { ServerKoaController } from "../../types";
import {
  handleAuthorizationCodeGrant,
  handleClientCredentialsGrant,
  handleRefreshTokenGrant,
} from "../../handler";

type RequestData = TokenRequestBody;

type ResponseBody = TokenResponse;

export const oauthTokenSchema = Joi.object<RequestData>()
  .keys({
    clientId: Joi.string().guid(),
    clientSecret: Joi.string(),
    code: JOI_CODE,
    codeVerifier: Joi.string(),
    grantType: JOI_GRANT_TYPE.required(),
    redirectUri: Joi.string().uri(),
    refreshToken: Joi.string(),
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

  if (!client.allowed.grantTypes.includes(grantType)) {
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
