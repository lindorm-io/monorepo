import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { OpenIDClaims, ResponseType } from "../../common";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { createURL } from "@lindorm-io/core";
import { find } from "lodash";
import {
  axiosAuthenticateOidcIdentity,
  axiosUpdateIdentityUserinfo,
  verifyOidcWithAccessToken,
  verifyOidcWithCode,
  verifyOidcWithIdToken,
} from "../../handler";

interface RequestData {
  code: string;
  expiresIn: number;
  idToken: string;
  state: string;
  token: string;
  tokenType: string;
}

export const oidcSessionCallbackSchema = Joi.object<RequestData>()
  .keys({
    code: Joi.string().optional(),
    expiresIn: Joi.string().optional(),
    idToken: Joi.string().optional(),
    state: Joi.string().required(),
    token: Joi.string().optional(),
    tokenType: Joi.string().optional(),
  })
  .required();

export const oidcSessionCallbackController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { oidcSessionCache },
    data: { code, idToken, token },
    entity: { oidcSession },
  } = ctx;

  const config = find(configuration.oidc_providers, { key: oidcSession.provider });

  if (!config) {
    throw new ServerError("Invalid identity provider");
  }

  if (oidcSession.verified) {
    throw new ClientError("Session already verified");
  }

  const { response_type: responseType } = config;

  let claims: OpenIDClaims | undefined;

  switch (responseType) {
    case ResponseType.CODE:
      claims = await verifyOidcWithCode(ctx, oidcSession, code);
      break;

    case ResponseType.ID_TOKEN:
      claims = await verifyOidcWithIdToken(ctx, oidcSession, idToken);
      break;

    case ResponseType.TOKEN:
      claims = await verifyOidcWithAccessToken(ctx, oidcSession, token);
      break;

    default:
      throw new ServerError("Unknown response type");
  }

  const { identityId } = await axiosAuthenticateOidcIdentity(ctx, oidcSession, {
    provider: config.base_url,
    subject: claims.sub,
  });

  oidcSession.identityId = identityId;

  await axiosUpdateIdentityUserinfo(ctx, identityId, {
    provider: config.base_url,
    ...claims,
  });

  oidcSession.verified = true;

  await oidcSessionCache.update(oidcSession);

  return {
    redirect: createURL(oidcSession.callbackUri, { query: { sessionId: oidcSession.id } }),
  };
};
