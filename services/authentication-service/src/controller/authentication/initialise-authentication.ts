import Joi from "joi";
import { AuthenticationMethod } from "../../enum";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { filter, find, includes } from "lodash";
import { getExpires } from "@lindorm-io/core";
import { handleAuthenticationInitialisation } from "../../handler";
import {
  JOI_AUTHENTICATION_METHOD,
  JOI_PKCE_METHOD,
  REGEX_EMAIL,
  REGEX_PHONE,
} from "../../constant";
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
    loginHint: Joi.array().items(Joi.string()).optional(),
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
      loginHint,
      methods,
      nonce,
      redirectUri,
    },
  } = ctx;

  const { expires } = getExpires(configuration.defaults.authentication_session_expiry);

  const emailHint = find(loginHint, (item) => REGEX_EMAIL.test(item));
  const phoneHint = find(loginHint, (item) => REGEX_PHONE.test(item));

  const authenticationSession = await handleAuthenticationInitialisation(ctx, {
    clientId,
    codeChallenge,
    codeMethod,
    country,
    emailHint,
    expires,
    identityId,
    nonce,
    phoneHint,
    redirectUri,
    requestedLevelOfAssurance: levelOfAssurance,
    requestedMethods: filter(methods, (key) =>
      includes(Object.values(AuthenticationMethod), key),
    ) as Array<AuthenticationMethod>,
  });

  return {
    body: { id: authenticationSession.id },
  };
};
