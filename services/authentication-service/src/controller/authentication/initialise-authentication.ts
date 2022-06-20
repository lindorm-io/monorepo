import Joi from "joi";
import { AuthenticationMethod } from "../../enum";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { getExpiryDate } from "@lindorm-io/core";
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
    codeChallengeMethod: JOI_PKCE_METHOD.required(),
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
      codeChallengeMethod,
      country,
      identityId,
      levelOfAssurance,
      loginHint,
      methods,
      nonce,
      redirectUri,
    },
  } = ctx;

  const expires = getExpiryDate(configuration.defaults.authentication_session_expiry);

  const emailHint = loginHint?.find((item) => REGEX_EMAIL.test(item));
  const phoneHint = loginHint?.find((item) => REGEX_PHONE.test(item));

  const authenticationSession = await handleAuthenticationInitialisation(ctx, {
    clientId,
    codeChallenge,
    codeChallengeMethod,
    country,
    emailHint,
    expires,
    identityId,
    nonce,
    phoneHint,
    redirectUri,
    requestedLevelOfAssurance: levelOfAssurance,
    requestedMethods: methods.filter((key: AuthenticationMethod) =>
      Object.values(AuthenticationMethod).includes(key),
    ) as Array<AuthenticationMethod>,
  });

  return {
    body: { id: authenticationSession.id },
  };
};
