import Joi from "joi";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { OpenIdClaims, OpenIdResponseType } from "@lindorm-io/common-types";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { createURL } from "@lindorm-io/url";
import { find } from "lodash";
import {
  authenticateIdentity,
  resolveIdentity,
  updateIdentityUserinfo,
  verifyOidcWithAccessToken,
  verifyOidcWithCode,
  verifyOidcWithIdToken,
} from "../../handler";

type RequestData = {
  code: string;
  expiresIn: number;
  idToken: string;
  state: string;
  token: string;
  tokenType: string;
};

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
    redis: { oidcSessionCache },
    data: { code, idToken, token },
  } = ctx;

  let {
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

  let claims: OpenIdClaims | undefined;

  switch (responseType) {
    case OpenIdResponseType.CODE:
      claims = await verifyOidcWithCode(ctx, oidcSession, code);
      break;

    case OpenIdResponseType.ID_TOKEN:
      claims = await verifyOidcWithIdToken(ctx, oidcSession, idToken);
      break;

    case OpenIdResponseType.TOKEN:
      claims = await verifyOidcWithAccessToken(ctx, oidcSession, token);
      break;

    default:
      throw new ServerError("Unknown response type");
  }

  const options = {
    provider: config.base_url,
    subject: claims.sub,
  };

  oidcSession = await resolveIdentity(ctx, oidcSession, options);

  if (!oidcSession.identityId) {
    throw new ServerError("Invalid session");
  }

  await authenticateIdentity(ctx, oidcSession, options);

  await updateIdentityUserinfo(ctx, oidcSession.identityId, {
    provider: config.base_url,
    ...claims,
  });

  oidcSession.verified = true;

  await oidcSessionCache.update(oidcSession);

  return {
    redirect: createURL(oidcSession.callbackUri, { query: { session: oidcSession.id } }),
  };
};
