import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_AUTHENTICATION_METHOD, JOI_PKCE_METHOD } from "../../constant";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { getExpires } from "@lindorm-io/core";
import { handleAuthenticationInitialisation } from "../../handler";
import {
  InitialiseAuthenticationRequestData,
  InitialiseAuthenticationResponseBody,
  JOI_GUID,
  JOI_LEVEL_OF_ASSURANCE,
} from "../../common";

export const initialiseAuthenticationSchema = Joi.object<InitialiseAuthenticationRequestData>()
  .keys({
    clientId: JOI_GUID.required(),
    codeChallenge: Joi.string().required(),
    codeMethod: JOI_PKCE_METHOD.required(),
    country: Joi.string().lowercase().length(2).optional(),
    identityId: JOI_GUID.optional(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.optional(),
    methods: Joi.array().items(JOI_AUTHENTICATION_METHOD).optional(),
    nonce: Joi.string().optional(),
    redirectUri: Joi.string().uri().optional(),
  })
  .required();

export const initialiseAuthenticationController: ServerKoaController<
  InitialiseAuthenticationRequestData
> = async (ctx): ControllerResponse<InitialiseAuthenticationResponseBody> => {
  const {
    data: {
      clientId,
      codeChallenge,
      codeMethod,
      country,
      identityId,
      levelOfAssurance,
      methods,
      nonce,
      redirectUri,
    },
  } = ctx;

  const { expires } = getExpires(configuration.defaults.authentication_session_expiry);

  const authenticationSession = await handleAuthenticationInitialisation(ctx, {
    clientId,
    codeChallenge,
    codeMethod,
    country,
    expires,
    identityId,
    nonce,
    redirectUri,
    requestedLevelOfAssurance: levelOfAssurance,
    requestedMethods: methods,
  });

  return {
    body: { id: authenticationSession.id },
  };
};
