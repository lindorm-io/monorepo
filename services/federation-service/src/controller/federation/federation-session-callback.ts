import { OpenIdResponseType } from "@lindorm-io/common-enums";
import { OpenIdClaims } from "@lindorm-io/common-types";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { createURL } from "@lindorm-io/url";
import Joi from "joi";
import { find } from "lodash";
import {
  authenticateIdentity,
  resolveIdentity,
  updateIdentityUserinfo,
  verifyFederationWithAccessToken,
  verifyFederationWithCode,
  verifyFederationWithIdToken,
} from "../../handler";
import { configuration } from "../../server/configuration";
import { ServerKoaController } from "../../types";

type RequestData = {
  code: string;
  expiresIn: number;
  idToken: string;
  state: string;
  token: string;
  tokenType: string;
};

export const federationSessionCallbackSchema = Joi.object<RequestData>()
  .keys({
    code: Joi.string().optional(),
    expiresIn: Joi.string().optional(),
    idToken: Joi.string().optional(),
    state: Joi.string().required(),
    token: Joi.string().optional(),
    tokenType: Joi.string().optional(),
  })
  .required();

export const federationSessionCallbackController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    redis: { federationSessionCache },
    data: { code, idToken, token },
  } = ctx;

  let {
    entity: { federationSession },
  } = ctx;

  const config = find(configuration.federation_providers, { key: federationSession.provider });

  if (!config) {
    throw new ServerError("Invalid identity provider");
  }

  if (federationSession.verified) {
    throw new ClientError("Session already verified");
  }

  const { response_type: responseType } = config;

  let claims: OpenIdClaims | undefined;

  switch (responseType) {
    case OpenIdResponseType.CODE:
      claims = await verifyFederationWithCode(ctx, federationSession, code);
      break;

    case OpenIdResponseType.ID_TOKEN:
      claims = await verifyFederationWithIdToken(ctx, federationSession, idToken);
      break;

    case OpenIdResponseType.TOKEN:
      claims = await verifyFederationWithAccessToken(ctx, federationSession, token);
      break;

    default:
      throw new ServerError("Unknown response type");
  }

  const options = {
    provider: config.base_url,
    subject: claims.sub,
  };

  federationSession = await resolveIdentity(ctx, federationSession, options);

  if (!federationSession.identityId) {
    throw new ServerError("Invalid session");
  }

  await authenticateIdentity(ctx, federationSession, options);

  await updateIdentityUserinfo(ctx, federationSession.identityId, {
    provider: config.base_url,
    ...claims,
  });

  federationSession.verified = true;

  await federationSessionCache.update(federationSession);

  return {
    redirect: createURL(federationSession.callbackUri, {
      query: { session: federationSession.id },
    }),
  };
};
