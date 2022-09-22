import Joi from "joi";
import { AuthenticationMode } from "../../enum";
import { AuthenticationSession } from "../../entity";
import { AuthenticationMethod, JOI_GUID, JOI_LEVEL_OF_ASSURANCE } from "../../common";
import { LevelOfAssurance } from "@lindorm-io/jwt";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { getExpiryDate, PKCEMethod } from "@lindorm-io/core";
import { handleAuthenticationInitialisation } from "./handle-authentication-initialisation";
import {
  JOI_AUTHENTICATION_METHOD,
  JOI_PKCE_METHOD,
  REGEX_EMAIL,
  REGEX_PHONE,
} from "../../constant";

type Options = {
  clientId?: string;
  codeChallenge: string;
  codeChallengeMethod: PKCEMethod;
  country?: string;
  identityId?: string;
  levelOfAssurance?: LevelOfAssurance;
  loginHint?: Array<string>;
  methods?: Array<string>;
  nonce?: string;
};

const schema = Joi.object<Options>()
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
  })
  .options({ abortEarly: false, allowUnknown: false })
  .required();

export const initialiseStandardAuthenticationSession = async (
  ctx: ServerKoaContext,
  options: Options,
): Promise<AuthenticationSession> => {
  await schema.validateAsync(options);

  const {
    clientId,
    codeChallenge,
    codeChallengeMethod,
    country,
    identityId,
    levelOfAssurance,
    loginHint,
    methods,
    nonce,
  } = options;

  const expires = getExpiryDate(configuration.defaults.authentication_session_expiry);
  const emailHint = loginHint?.find((item) => REGEX_EMAIL.test(item));
  const phoneHint = loginHint?.find((item) => REGEX_PHONE.test(item));

  return await handleAuthenticationInitialisation(ctx, {
    clientId,
    codeChallenge,
    codeChallengeMethod,
    country,
    emailHint,
    expires,
    identityId,
    nonce,
    mode: AuthenticationMode.STANDARD,
    phoneHint,
    requestedLevel: levelOfAssurance,
    requestedMethods: methods.filter((key: AuthenticationMethod) =>
      Object.values(AuthenticationMethod).includes(key),
    ) as Array<AuthenticationMethod>,
  });
};
