import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ServerKoaController, OAuthTokenRequestData, OAuthTokenResponseBody } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_CODE, JOI_GRANT_TYPE } from "../../constant";
import { JOI_GUID, JOI_JWT, GrantType } from "../../common";
import { includes } from "lodash";
import {
  handleAuthorizationCodeGrant,
  handleClientCredentialsGrant,
  handleRefreshTokenGrant,
} from "../../handler";

export const oauthTokenSchema = Joi.object({
  clientId: JOI_GUID.optional(),
  clientSecret: Joi.string().optional(),
  code: JOI_CODE.optional(),
  codeVerifier: Joi.string().base64().optional(),
  grantType: JOI_GRANT_TYPE.required(),
  redirectUri: Joi.string().uri().optional(),
  refreshToken: JOI_JWT.optional(),
  scope: Joi.string().optional(),
});

export const oauthTokenController: ServerKoaController<OAuthTokenRequestData> = async (
  ctx,
): ControllerResponse<Partial<OAuthTokenResponseBody>> => {
  const {
    data: { grantType },
    entity: { client },
  } = ctx;

  if (!includes(client.allowed.grantTypes, grantType)) {
    throw new ClientError("Invalid Grant Type", {
      code: "invalid_request",
      debug: {
        expect: client.allowed.grantTypes,
        actual: grantType,
      },
      description: "Invalid grant type",
    });
  }

  let body: Partial<OAuthTokenResponseBody>;

  switch (grantType) {
    case GrantType.AUTHORIZATION_CODE:
      body = await handleAuthorizationCodeGrant(ctx);
      break;

    case GrantType.CLIENT_CREDENTIALS:
      body = await handleClientCredentialsGrant(ctx);
      break;

    case GrantType.REFRESH_TOKEN:
      body = await handleRefreshTokenGrant(ctx);
      break;

    default:
      break;
  }

  return { body };
};
